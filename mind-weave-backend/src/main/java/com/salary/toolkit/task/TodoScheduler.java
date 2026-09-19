package com.salary.toolkit.task;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.salary.toolkit.entity.TkSetting;
import com.salary.toolkit.entity.Todo;
import com.salary.toolkit.mapper.TkSettingMapper;
import com.salary.toolkit.mapper.TodoMapper;
import com.salary.toolkit.service.BarkClient;
import com.salary.toolkit.service.ReminderSchedule;
import com.salary.weixin.WxSubscribeService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/** Single-instance scheduler. Delivery cursors are persisted; temporary retry backoff is process-local. */
@Slf4j
@Component
public class TodoScheduler {
    private static final DateTimeFormatter DISPLAY = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter PUSH_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final int[] RETRY_MINUTES = {1, 2, 5, 15, 60};
    private final TodoMapper todoMapper;
    private final TkSettingMapper settingMapper;
    private final BarkClient barkClient;
    private final WxSubscribeService wxSubscribeService;
    private final Clock clock;
    private final Map<String, Retry> retries = new HashMap<>();
    private final Map<String, Attempt> recentAttempts = new ConcurrentHashMap<>();

    public volatile long lastRunAt;

    @Autowired
    public TodoScheduler(TodoMapper todoMapper, TkSettingMapper settingMapper,
                         BarkClient barkClient, WxSubscribeService wxSubscribeService) {
        this(todoMapper, settingMapper, barkClient, wxSubscribeService, Clock.system(ReminderSchedule.ZONE));
    }

    TodoScheduler(TodoMapper todoMapper, TkSettingMapper settingMapper,
                  BarkClient barkClient, WxSubscribeService wxSubscribeService, Clock clock) {
        this.todoMapper = todoMapper;
        this.settingMapper = settingMapper;
        this.barkClient = barkClient;
        this.wxSubscribeService = wxSubscribeService;
        this.clock = clock.withZone(ReminderSchedule.ZONE);
    }

    /** Only exposes the current user's configuration and todo counts. */
    public Map<String, Object> status(String owner) {
        LocalDateTime now = now();
        List<Todo> personal = todoMapper.selectList(new LambdaQueryWrapper<Todo>().eq(Todo::getOwner, owner));
        List<Todo> active = personal.stream().filter(t -> !sent(t.getDone())).toList();
        Attempt attempt = recentAttempts.get(owner);
        LocalDateTime lastSuccess = personal.stream().map(Todo::getLastRemindTime).filter(Objects::nonNull)
                .max(LocalDateTime::compareTo).orElse(null);
        if (attempt != null && attempt.successAt != null
                && (lastSuccess == null || lastSuccess.isBefore(attempt.successAt))) lastSuccess = attempt.successAt;
        Map<String, Object> result = new LinkedHashMap<>();
        boolean barkConfigured = barkUrl(owner) != null;
        boolean wxConfigured = wxSubscribeService.isConfigured(owner);
        List<String> channels = new ArrayList<>();
        if (barkConfigured) channels.add("BARK");
        if (wxConfigured) channels.add("WECHAT");
        LocalDateTime nextReminder = active.stream().map(t -> nextEvent(t, now)).filter(Objects::nonNull)
                .min(LocalDateTime::compareTo).orElse(null);
        result.put("lastRunAt", lastRunAt == 0 ? null
                : Instant.ofEpochMilli(lastRunAt).atZone(ReminderSchedule.ZONE).format(DISPLAY));
        result.put("barkConfigured", barkConfigured);
        result.put("wxConfigured", wxConfigured);
        result.put("deliveryReady", barkConfigured || wxConfigured);
        result.put("channels", channels);
        result.put("templateId", wxSubscribeService.templateId());
        result.put("pendingRemind", active.stream().filter(t -> due(t.getRemindTime(), now)
                && !sent(t.getRemindSent())).count());
        result.put("upcomingRemind", active.stream().filter(t -> t.getRemindTime() != null
                && t.getRemindTime().isAfter(now) && !sent(t.getRemindSent())).count());
        result.put("pendingOverdue", active.stream().filter(t -> due(t.getDueTime(), now)
                && !sent(t.getOverdueSent())).count());
        result.put("activeRecurring", active.stream().filter(TodoScheduler::recurring).count());
        result.put("timezone", ReminderSchedule.ZONE.getId());
        result.put("catchUpHours", ReminderSchedule.CATCH_UP_HOURS);
        result.put("scanIntervalSeconds", 30);
        result.put("lastAttemptAt", attempt == null ? null : format(attempt.at));
        result.put("lastSuccessAt", format(lastSuccess));
        result.put("lastResult", attempt == null ? null : attempt.result);
        result.put("nextReminderAt", format(nextReminder));
        return result;
    }

    public synchronized void subscriptionGranted(String owner) {
        List<Todo> active = todoMapper.selectList(new LambdaQueryWrapper<Todo>()
                .eq(Todo::getOwner, owner).eq(Todo::getDone, 0));
        Set<String> keys = new HashSet<>();
        for (Todo todo : active) {
            for (String kind : List.of("reminder", "recurring", "overdue")) keys.add(key(todo, kind));
        }
        retries.keySet().removeIf(keys::contains);
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 10_000)
    public synchronized void run() {
        lastRunAt = clock.millis();
        try {
            Map<String, String> barkUrls = barkUrlsByOwner();
            List<Todo> active = todoMapper.selectList(new LambdaQueryWrapper<Todo>().eq(Todo::getDone, 0));
            Set<String> liveKeys = new HashSet<>();
            for (Todo todo : active) {
                for (String kind : List.of("reminder", "recurring", "overdue")) liveKeys.add(key(todo, kind));
                try {
                    remind(todo, barkUrls.get(todo.getOwner()), now());
                } catch (Exception e) {
                    log.error("待办提醒处理异常，待办 ID: {}，类型: {}", todo.getId(), e.getClass().getSimpleName());
                }
                if (Thread.currentThread().isInterrupted()) return;
            }
            retries.keySet().removeIf(k -> k.startsWith("todo:") && !liveKeys.contains(k));
            dailyDigest(now(), barkUrls);
            recentAttempts.entrySet().removeIf(e -> e.getValue().at.isBefore(now().minusDays(7)));
        } catch (Exception e) {
            log.error("待办调度扫描异常，类型: {}", e.getClass().getSimpleName());
        }
    }

    void remind(Todo todo, String barkUrl, LocalDateTime now) {
        boolean overdue = due(todo.getDueTime(), now) && !sent(todo.getOverdueSent());
        boolean once = due(todo.getRemindTime(), now) && !sent(todo.getRemindSent());
        LocalDateTime fire = null;
        if (recurring(todo)) {
            try {
                fire = ReminderSchedule.latestDue(todo.getRecurRule(), todo.getRecurLastFired(), todo.getCreatedAt(), now);
            } catch (IllegalArgumentException e) {
                log.warn("待办循环规则无效，待办 ID: {}", todo.getId());
            }
        }
        if (!overdue && !once && fire == null) return;
        String kind = overdue ? "overdue" : fire != null ? "recurring" : "reminder";
        String title = overdue ? "[逾期待办] " + todo.getTitle() : fire != null ? "循环提醒" : "待办提醒";
        LocalDateTime eventTime = overdue ? todo.getDueTime()
                : fire != null ? fire : todo.getRemindTime() != null ? todo.getRemindTime() : now;
        String revision = Objects.toString(todo.getUpdatedAt(), "") + "|" + Objects.toString(barkUrl, "");
        if (!deliver(key(todo, kind), revision, todo.getOwner(), barkUrl, title, pushBody(todo), eventTime, now, true)) return;

        // Coalesce reminders already due. Update delivery columns only, and do not overwrite a concurrent edit.
        LambdaUpdateWrapper<Todo> update = new LambdaUpdateWrapper<Todo>()
                .eq(Todo::getId, todo.getId()).eq(Todo::getOwner, todo.getOwner()).eq(Todo::getDone, 0);
        if (todo.getUpdatedAt() == null) update.isNull(Todo::getUpdatedAt);
        else update.eq(Todo::getUpdatedAt, todo.getUpdatedAt());
        if (once) update.set(Todo::getRemindSent, 1);
        if (overdue) update.set(Todo::getOverdueSent, 1);
        if (fire != null) update.set(Todo::getRecurLastFired, fire);
        update.set(Todo::getLastRemindTime, now);
        if (todoMapper.update(null, update) > 0) {
            if (once) todo.setRemindSent(1);
            if (overdue) todo.setOverdueSent(1);
            if (fire != null) todo.setRecurLastFired(fire);
            todo.setLastRemindTime(now);
        }
    }

    /** Any successful channel completes the event, preventing duplicate sends on the successful channel. */
    private boolean deliver(String key, String revision, String owner, String barkUrl, String title,
                            String body, LocalDateTime eventTime, LocalDateTime now, boolean useWechat) {
        Retry retry = retries.get(key);
        if (retry != null && Objects.equals(revision, retry.revision) && now.isBefore(retry.nextAt)) return false;
        boolean barkSent = false;
        boolean barkFailed = false;
        if (barkUrl != null) {
            try { barkSent = barkClient.send(barkUrl, title, body); }
            catch (Exception e) { log.warn("Bark 推送异常，用户: {}", owner); }
            barkFailed = !barkSent;
        }
        WxSubscribeService.SendResult wx = WxSubscribeService.SendResult.SKIPPED;
        if (useWechat) {
            try { wx = wxSubscribeService.sendReminder(owner, title, eventTime.format(PUSH_TIME), body); }
            catch (Exception e) { wx = WxSubscribeService.SendResult.FAILED; }
            if (wx == null) wx = WxSubscribeService.SendResult.FAILED;
        }
        boolean success = barkSent || wx == WxSubscribeService.SendResult.SENT;
        boolean failed = barkFailed || wx == WxSubscribeService.SendResult.FAILED;
        String result = success ? failed ? "PARTIAL" : "SENT" : failed ? "FAILED" : "UNCONFIGURED";
        Attempt previous = recentAttempts.get(owner);
        recentAttempts.put(owner, new Attempt(now, success ? now : previous == null ? null : previous.successAt, result));
        if (success) {
            retries.remove(key);
            return true;
        }
        int attempts = retry != null && Objects.equals(revision, retry.revision) ? retry.attempts + 1 : 1;
        // No channel configured: recheck next scan so saving channel settings takes effect promptly.
        LocalDateTime nextAt = failed ? now.plusMinutes(RETRY_MINUTES[Math.min(attempts - 1, RETRY_MINUTES.length - 1)])
                : now.plusSeconds(30);
        retries.put(key, new Retry(revision, Math.min(attempts, RETRY_MINUTES.length), nextAt));
        return false;
    }

    private Map<String, String> barkUrlsByOwner() {
        List<TkSetting> settings = settingMapper.selectList(new LambdaQueryWrapper<TkSetting>()
                .in(TkSetting::getSetKey, List.of("bark.url", "bark.enabled")));
        Set<String> disabled = settings.stream().filter(s -> "bark.enabled".equals(s.getSetKey())
                        && "false".equalsIgnoreCase(s.getSetValue()))
                .map(TkSetting::getOwner).collect(Collectors.toSet());
        Map<String, String> result = new HashMap<>();
        for (TkSetting setting : settings) {
            if ("bark.url".equals(setting.getSetKey()) && setting.getSetValue() != null
                    && !setting.getSetValue().isBlank() && !disabled.contains(setting.getOwner())) {
                result.put(setting.getOwner(), setting.getSetValue().trim());
            }
        }
        return result;
    }

    private String barkUrl(String owner) {
        if ("false".equalsIgnoreCase(settingValue(owner, "bark.enabled"))) return null;
        String value = settingValue(owner, "bark.url");
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void dailyDigest(LocalDateTime now, Map<String, String> barkUrls) {
        for (Map.Entry<String, String> entry : barkUrls.entrySet()) {
            String owner = entry.getKey();
            try {
                String digest = settingValue(owner, "todo.digest");
                if (digest == null || digest.isBlank()) continue;
                LocalTime target;
                try { target = LocalTime.parse(digest.trim()); }
                catch (RuntimeException e) { continue; }
                // Catch up today's digest after the target, including delayed scans and restarts.
                if (now.toLocalTime().isBefore(target)) continue;
                String today = now.toLocalDate().toString();
                if (today.equals(settingValue(owner, "todo.lastDigest"))) continue;
                LocalDateTime start = now.toLocalDate().plusDays(1).atStartOfDay();
                List<Todo> tomorrow = todoMapper.selectList(new LambdaQueryWrapper<Todo>()
                        .eq(Todo::getOwner, owner).eq(Todo::getDone, 0)
                        .ge(Todo::getDueTime, start).lt(Todo::getDueTime, start.plusDays(1)));
                String key = "digest:" + owner;
                if (!tomorrow.isEmpty()) {
                    String titles = tomorrow.stream().map(Todo::getTitle).limit(5).collect(Collectors.joining("、"));
                    if (!deliver(key, today + "|" + digest + "|" + entry.getValue(), owner, entry.getValue(), "明日待办预告",
                            tomorrow.size() + " 项待办：" + titles, start, now, false)) continue;
                }
                upsertSetting(owner, "todo.lastDigest", today, now);
                retries.remove(key);
            } catch (Exception e) {
                log.error("待办每日汇总异常，用户: {}，类型: {}", owner, e.getClass().getSimpleName());
            }
        }
        retries.keySet().removeIf(k -> k.startsWith("digest:") && !barkUrls.containsKey(k.substring(7)));
    }

    private String settingValue(String owner, String key) {
        TkSetting setting = settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, owner).eq(TkSetting::getSetKey, key));
        return setting == null ? null : setting.getSetValue();
    }

    private void upsertSetting(String owner, String key, String value, LocalDateTime now) {
        TkSetting setting = settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, owner).eq(TkSetting::getSetKey, key));
        boolean create = setting == null;
        if (create) {
            setting = new TkSetting();
            setting.setOwner(owner);
            setting.setSetKey(key);
        }
        setting.setSetValue(value);
        setting.setUpdatedAt(now);
        if (create) settingMapper.insert(setting);
        else settingMapper.updateById(setting);
    }

    private LocalDateTime now() { return LocalDateTime.now(clock); }
    private static boolean sent(Integer value) { return Integer.valueOf(1).equals(value); }
    private static boolean due(LocalDateTime value, LocalDateTime now) { return value != null && !value.isAfter(now); }
    private static boolean recurring(Todo todo) { return todo.getRecurRule() != null && !todo.getRecurRule().isBlank(); }
    private static LocalDateTime nextEvent(Todo todo, LocalDateTime now) {
        LocalDateTime next = null;
        if (!sent(todo.getRemindSent()) && todo.getRemindTime() != null) {
            next = todo.getRemindTime().isBefore(now) ? now : todo.getRemindTime();
        }
        if (!sent(todo.getOverdueSent()) && todo.getDueTime() != null) {
            LocalDateTime due = todo.getDueTime().isBefore(now) ? now : todo.getDueTime();
            if (next == null || due.isBefore(next)) next = due;
        }
        if (recurring(todo)) {
            try {
                LocalDateTime recurring = ReminderSchedule.nextDue(todo.getRecurRule(), now);
                if (recurring != null && (next == null || recurring.isBefore(next))) next = recurring;
            } catch (IllegalArgumentException ignored) {
                // 无效规则会在扫描时记录，不影响状态页。
            }
        }
        return next;
    }
    private static String format(LocalDateTime time) { return time == null ? null : time.format(DISPLAY); }
    private static String key(Todo todo, String kind) { return "todo:" + todo.getId() + ":" + kind; }
    private static String pushBody(Todo todo) {
        return todo.getRemindNote() == null || todo.getRemindNote().isBlank() ? todo.getTitle()
                : todo.getTitle() + "：" + todo.getRemindNote();
    }
    private record Retry(String revision, int attempts, LocalDateTime nextAt) { }
    private record Attempt(LocalDateTime at, LocalDateTime successAt, String result) { }
}
