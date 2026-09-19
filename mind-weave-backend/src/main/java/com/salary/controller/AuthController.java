package com.salary.controller;

import com.salary.common.Result;
import com.salary.dto.LoginRequest;
import com.salary.dto.LoginResponse;
import com.salary.dto.PasswordRequest;
import com.salary.dto.UserInfo;
import com.salary.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        return Result.ok(authService.login(req));
    }

    @GetMapping("/me")
    public Result<UserInfo> me() {
        return Result.ok(authService.me());
    }

    @PutMapping("/password")
    public Result<Void> changePassword(@Valid @RequestBody PasswordRequest req) {
        authService.changePassword(req);
        return Result.ok();
    }
}
