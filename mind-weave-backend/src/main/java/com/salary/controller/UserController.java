package com.salary.controller;

import com.salary.common.Result;
import com.salary.dto.UserInfo;
import com.salary.dto.UserRequest;
import com.salary.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class UserController {
    private final UserService userService;

    @GetMapping
    public Result<List<UserInfo>> list() {
        return Result.ok(userService.list());
    }

    @PostMapping
    public Result<UserInfo> create(@Valid @RequestBody UserRequest req) {
        return Result.ok(userService.create(req));
    }

    @PutMapping("/{id}")
    public Result<UserInfo> update(@PathVariable Long id, @Valid @RequestBody UserRequest req) {
        return Result.ok(userService.update(id, req));
    }

    @PostMapping("/{id}/reset-password")
    public Result<Void> resetPassword(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        userService.resetPassword(id, body == null ? null : body.get("newPassword"));
        return Result.ok();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return Result.ok();
    }
}
