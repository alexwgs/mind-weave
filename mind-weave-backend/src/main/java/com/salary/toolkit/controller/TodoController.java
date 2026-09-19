package com.salary.toolkit.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.Result;
import com.salary.toolkit.dto.TodoReq;
import com.salary.toolkit.entity.Todo;
import com.salary.toolkit.entity.TodoSub;
import com.salary.toolkit.service.TodoService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tool/todos")
@RequiredArgsConstructor
public class TodoController {
    private final TodoService todoService;

    @GetMapping
    public Result<Page<Todo>> page(@RequestParam(defaultValue = "1") int page,
                                   @RequestParam(defaultValue = "50") int size,
                                   @RequestParam(required = false) String status,
                                   @RequestParam(required = false) String project,
                                   @RequestParam(required = false) String priority,
                                   @RequestParam(required = false) String keyword) {
        return Result.ok(todoService.page(page, size, status, project, priority, keyword));
    }

    @GetMapping("/calendar")
    public Result<List<Todo>> calendar(@RequestParam String month) {
        return Result.ok(todoService.calendar(month));
    }

    @GetMapping("/projects")
    public Result<List<String>> projects() {
        return Result.ok(todoService.listProjects());
    }

    @GetMapping("/scheduler-status")
    public Result<java.util.Map<String, Object>> schedulerStatus() {
        return Result.ok(todoService.schedulerStatus());
    }

    @GetMapping("/summary")
    public Result<java.util.Map<String, Object>> summary() {
        return Result.ok(todoService.summary());
    }

    @PostMapping("/subscription-granted")
    public Result<Void> subscriptionGranted() {
        todoService.subscriptionGranted();
        return Result.ok();
    }

    @GetMapping("/{id}")
    public Result<Todo> detail(@PathVariable Long id) {
        return Result.ok(todoService.detail(id));
    }

    @PostMapping
    public Result<Todo> create(@RequestBody TodoReq req) {
        return Result.ok(todoService.create(req));
    }

    @PutMapping("/{id}")
    public Result<Todo> update(@PathVariable Long id, @RequestBody TodoReq req) {
        return Result.ok(todoService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        todoService.delete(id);
        return Result.ok();
    }

    @PostMapping("/{id}/toggle")
    public Result<Todo> toggle(@PathVariable Long id) {
        return Result.ok(todoService.toggle(id));
    }

    @PostMapping("/{id}/subs/{sid}/toggle")
    public Result<TodoSub> toggleSub(@PathVariable Long id, @PathVariable Long sid) {
        return Result.ok(todoService.toggleSub(id, sid));
    }
}
