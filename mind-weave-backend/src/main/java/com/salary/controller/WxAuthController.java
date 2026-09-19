package com.salary.controller;

import com.salary.common.Result;
import com.salary.dto.WxBindRequest;
import com.salary.dto.WxLoginRequest;
import com.salary.dto.WxLoginResponse;
import com.salary.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class WxAuthController {
    private final AuthService authService;

    @PostMapping("/wx-login")
    public Result<WxLoginResponse> wxLogin(@RequestBody(required = false) WxLoginRequest req) {
        return Result.ok(authService.wxLogin(req == null ? null : req.getCode()));
    }

    @PostMapping("/wx-bind")
    public Result<WxLoginResponse> wxBind(@Valid @RequestBody WxBindRequest req) {
        return Result.ok(authService.wxBind(req.getCode(), req.getUsername(), req.getPassword()));
    }
}
