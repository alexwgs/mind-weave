package com.salary.toolkit.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.BizException;
import com.salary.security.SecurityUtils;
import com.salary.toolkit.dto.TodoReq;
import com.salary.toolkit.entity.Todo;
import com.salary.toolkit.entity.TodoSub;
import com.salary.toolkit.mapper.TodoMapper;
import com.salary.toolkit.mapper.TodoSubMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class TodoService {
    private final TodoMapper todoMapper;
    private final TodoSubMapper subMapper;
    private final com.salary.service.PermissionService permissionService;
    private final com.salary.service.LogService logService;
    private final com.salary.toolkit.task.TodoScheduler todoScheduler;

    private String owner() {
        return SecurityUtils.currentUsername();
    }

    public Page<Todo> page(int page, int size, String status, String project, String priority, String keyword) {
        permissionService.require("todos");
        LocalDateTime now = LocalDateTime.now(ReminderSchedule.ZONE);
        LocalDateTime today = now.toLocalDate().atStartOfDay();
        LambdaQueryWrapper<Todo> qw = new LambdaQueryWrapper<Todo>()
                .eq(Todo::getOwner, owner());
        if ("done".equals(status)) qw.eq(Todo::getDone, 1);
        else if ("active".equals(status)) qw.eq(Todo::getDone, 0);
        else if ("overdue".equals(status)) qw.eq(Todo::getDone, 0).isNotNull(Todo::getDueTime).lt(Todo::getDueTime, now);
        else if ("today".equals(status)) qw.eq(Todo::getDone, 0).ge(Todo::getDueTime, today).lt(Todo::getDueTime, today.plusDays(1));
        else if ("upcoming".equals(status)) qw.eq(Todo::getDone, 0).ge(Todo::getDueTime, today.plusDays(1)).lt(Todo::getDueTime, today.plusDays(8));
        if (project != null && !project.isBlank()) qw.eq(Todo::getProject, project);
        if (priority != null && !priority.isBlank()) qw.eq(Todo::getPriority, priority);
        if (keyword != null && !keyword.isBlank()) qw.like(Todo::getTitle, keyword);
        qw.orderByAsc(Todo::getDone).orderByAsc(Todo::getDueTime).orderByDesc(Todo::getCreatedAt);
        Page<Todo> p = todoMapper.selectPage(new Page<>(page, size), qw);
        p.getRecords().forEach(this::fillSubs);
        return p;
    }

    public Map<String, Object> summary() {
        permissionService.require("todos");
        LocalDateTime now = LocalDateTime.now(ReminderSchedule.ZONE);
        LocalDateTime today = now.toLocalDate().atStartOfDay();
        List<Todo> rows = todoMapper.selectList(new LambdaQueryWrapper<Todo>().eq(Todo::getOwner, owner()));
        long active = rows.stream().filter(t -> !done(t)).count();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("active", active);
        result.put("completed", rows.size() - active);
        result.put("overdue", rows.stream().filter(t -> !done(t) && t.getDueTime() != null && t.getDueTime().isBefore(now)).count());
        result.put("today", rows.stream().filter(t -> !done(t) && between(t.getDueTime(), today, today.plusDays(1))).count());
        result.put("upcoming", rows.stream().filter(t -> !done(t) && between(t.getDueTime(), today.plusDays(1), today.plusDays(8))).count());
        result.put("withReminder", rows.stream().filter(t -> !done(t) && (t.getRemindTime() != null || hasRule(t))).count());
        result.put("recurring", rows.stream().filter(t -> !done(t) && hasRule(t)).count());
        return result;
    }

    public List<Todo> calendar(String month) {
        permissionService.require("todos");
        LocalDateTime start;
        try {
            start = LocalDate.parse(month + "-01").atStartOfDay();
        } catch (RuntimeException e) {
            throw new BizException("月份格式不正确，请使用 YYYY-MM");
        }
        LocalDateTime end = start.plusMonths(1);
        return todoMapper.selectList(new LambdaQueryWrapper<Todo>()
                .eq(Todo::getOwner, owner())
                .isNotNull(Todo::getDueTime)
                .ge(Todo::getDueTime, start)
                .lt(Todo::getDueTime, end)
                .orderByAsc(Todo::getDueTime));
    }

    public Todo detail(Long id) {
        permissionService.require("todos");
        Todo t = owned(id);
        fillSubs(t);
        return t;
    }

    @Transactional
    public Todo create(TodoReq req) {
        permissionService.require("todo.create");
        if (req.getTitle() == null || req.getTitle().isBlank()) throw new BizException("标题必填");
        Todo t = new Todo();
        t.setOwner(owner());
        apply(t, req);
        t.setDone(0);
        t.setRemindSent(0);
        t.setOverdueSent(0);
        t.setCreatedAt(LocalDateTime.now(ReminderSchedule.ZONE));
        t.setUpdatedAt(t.getCreatedAt());
        todoMapper.insert(t);
        saveSubs(t.getId(), req.getSubs());
        fillSubs(t);
        logService.record(owner(), "CREATE_TODO", "TODO", t.getId(), "新建待办 " + t.getTitle());
        return t;
    }

    @Transactional
    public Todo update(Long id, TodoReq req) {
        permissionService.require("todo.edit");
        Todo t = owned(id);
        LocalDateTime previousRemind = t.getRemindTime();
        LocalDateTime previousDue = t.getDueTime();
        String previousRule = t.getRecurRule();
        boolean wasDone = Integer.valueOf(1).equals(t.getDone());
        apply(t, req);
        if (!Objects.equals(previousRemind, t.getRemindTime())) t.setRemindSent(0);
        if (!Objects.equals(previousDue, t.getDueTime())) t.setOverdueSent(0);
        if (!Objects.equals(previousRule, t.getRecurRule())) {
            // This is a delivery cursor: a new schedule starts now, without replaying the old schedule.
            t.setRecurLastFired(t.getRecurRule() == null ? null : LocalDateTime.now(ReminderSchedule.ZONE));
            t.setRemindSent(0);
        }
        if (req.getDone() != null) {
            validateDone(req.getDone());
            t.setDone(req.getDone());
        }
        if (wasDone && !Integer.valueOf(1).equals(t.getDone())) {
            resetReminders(t);
        }
        t.setUpdatedAt(LocalDateTime.now(ReminderSchedule.ZONE));
        todoMapper.updateById(t);
        if (req.getSubs() != null) {
            subMapper.delete(new LambdaQueryWrapper<TodoSub>().eq(TodoSub::getTodoId, id));
            saveSubs(id, req.getSubs());
        }
        fillSubs(t);
        logService.record(owner(), "UPDATE_TODO", "TODO", t.getId(), "修改待办 " + t.getTitle());
        return t;
    }

    @Transactional
    public void delete(Long id) {
        permissionService.require("todo.delete");
        owned(id);
        subMapper.delete(new LambdaQueryWrapper<TodoSub>().eq(TodoSub::getTodoId, id));
        logService.record(owner(), "DELETE_TODO", "TODO", id, "删除待办 " + todoMapper.selectById(id).getTitle());
        todoMapper.deleteById(id);
    }

    public Todo toggle(Long id) {
        permissionService.require("todo.edit");
        Todo t = owned(id);
        t.setDone(t.getDone() == null || t.getDone() == 0 ? 1 : 0);
        if (t.getDone() == 0) resetReminders(t);
        t.setUpdatedAt(LocalDateTime.now(ReminderSchedule.ZONE));
        todoMapper.updateById(t);
        fillSubs(t);
        logService.record(owner(), "TOGGLE_TODO", "TODO", t.getId(),
                (t.getDone() == 1 ? "完成待办 " : "取消完成待办 ") + t.getTitle());
        return t;
    }

    public TodoSub toggleSub(Long todoId, Long subId) {
        permissionService.require("todo.edit");
        owned(todoId);
        TodoSub s = subMapper.selectById(subId);
        if (s == null || !s.getTodoId().equals(todoId)) throw new BizException("子任务不存在");
        s.setDone(s.getDone() == null || s.getDone() == 0 ? 1 : 0);
        subMapper.updateById(s);
        logService.record(owner(), "TOGGLE_TODO_SUB", "TODO_SUB", s.getId(),
                (s.getDone() == 1 ? "完成子任务 " : "取消完成子任务 ") + s.getTitle());
        return s;
    }

    public List<String> listProjects() {
        permissionService.require("todos");
        return todoMapper.selectList(new LambdaQueryWrapper<Todo>()
                        .eq(Todo::getOwner, owner())
                        .isNotNull(Todo::getProject)
                        .select(Todo::getProject))
                .stream().map(Todo::getProject).filter(p -> !p.isBlank()).distinct().toList();
    }

    /** 待办提醒调度状态（排查 Bark 推送用） */
    public java.util.Map<String, Object> schedulerStatus() {
        permissionService.require("todos");
        return todoScheduler.status(owner());
    }

    public void subscriptionGranted() {
        permissionService.require("todos");
        todoScheduler.subscriptionGranted(owner());
    }

    private void apply(Todo t, TodoReq req) {
        if (req.getTitle() != null) {
            if (req.getTitle().isBlank()) throw new BizException("标题必填");
            if (req.getTitle().trim().length() > 200) throw new BizException("标题不能超过 200 个字");
            t.setTitle(req.getTitle().trim());
        }
        String project = trimToNull(req.getProject());
        if (project != null && project.length() > 60) throw new BizException("项目名称不能超过 60 个字");
        t.setProject(project);
        if (req.getPriority() != null) {
            if (!List.of("LOW", "MEDIUM", "HIGH").contains(req.getPriority())) throw new BizException("优先级不正确");
            t.setPriority(req.getPriority());
        } else if (t.getPriority() == null) t.setPriority("MEDIUM");
        t.setDueTime(req.getDueTime());
        t.setRemindTime(req.getRemindTime());
        String remindNote = trimToNull(req.getRemindNote());
        if (remindNote != null && remindNote.length() > 120) throw new BizException("提醒备注不能超过 120 个字");
        t.setRemindNote(remindNote);
        if (t.getDueTime() != null && t.getRemindTime() != null && t.getRemindTime().isAfter(t.getDueTime())) {
            throw new BizException("提醒时间不能晚于截止时间");
        }
        try {
            t.setRecurRule(ReminderSchedule.normalize(req.getRecurRule()));
        } catch (IllegalArgumentException e) {
            throw new BizException("循环规则格式不正确，请使用有效的六段 Cron 表达式");
        }
    }

    private void resetReminders(Todo t) {
        t.setRemindSent(0);
        t.setOverdueSent(0);
        if (t.getRecurRule() != null && !t.getRecurRule().isBlank()) {
            t.setRecurLastFired(LocalDateTime.now(ReminderSchedule.ZONE));
        }
    }

    private static void validateDone(Integer value) {
        if (value != null && value != 0 && value != 1) throw new BizException("完成状态不正确");
    }

    private void saveSubs(Long todoId, List<TodoReq.SubReq> subs) {
        if (subs == null) return;
        int sort = 0;
        for (TodoReq.SubReq s : subs) {
            if (s.getTitle() == null || s.getTitle().isBlank()) continue;
            String title = s.getTitle().trim();
            if (title.length() > 120) throw new BizException("子任务不能超过 120 个字");
            validateDone(s.getDone());
            TodoSub sub = new TodoSub();
            sub.setTodoId(todoId);
            sub.setTitle(title);
            sub.setDone(s.getDone() == null ? 0 : s.getDone());
            sub.setSortOrder(sort++);
            subMapper.insert(sub);
        }
    }

    private void fillSubs(Todo t) {
        t.setSubs(subMapper.selectList(new LambdaQueryWrapper<TodoSub>()
                .eq(TodoSub::getTodoId, t.getId())
                .orderByAsc(TodoSub::getSortOrder)));
    }

    private Todo owned(Long id) {
        Todo t = todoMapper.selectById(id);
        if (t == null || !t.getOwner().equals(owner())) throw new BizException("待办不存在");
        return t;
    }

    private static boolean done(Todo todo) {
        return Integer.valueOf(1).equals(todo.getDone());
    }

    private static boolean hasRule(Todo todo) {
        return todo.getRecurRule() != null && !todo.getRecurRule().isBlank();
    }

    private static boolean between(LocalDateTime value, LocalDateTime start, LocalDateTime end) {
        return value != null && !value.isBefore(start) && value.isBefore(end);
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
