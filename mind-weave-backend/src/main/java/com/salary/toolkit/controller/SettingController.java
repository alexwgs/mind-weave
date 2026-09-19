package com.salary.toolkit.controller;

import com.salary.common.Result;
import com.salary.toolkit.dto.SettingVO;
import com.salary.toolkit.service.SettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/tool/settings")
@RequiredArgsConstructor
public class SettingController {
    private final SettingService settingService;
    private final com.salary.service.PermissionService permissionService;

    @GetMapping
    public Result<SettingVO> get() {
        return Result.ok(settingService.get());
    }

    @PutMapping
    public Result<Void> put(@RequestBody Map<String, String> body) {
        settingService.put(body);
        return Result.ok();
    }

    @PostMapping("/bark-test")
    public Result<Boolean> testBark(@RequestBody(required = false) Map<String, String> body) {
        String url = body == null ? null : body.get("barkUrl");
        return Result.ok(settingService.testBark(url));
    }

    @GetMapping("/wx-config")
    public Result<Map<String, Object>> wxConfig() {
        permissionService.require("settings.manage");
        return Result.ok(settingService.wxConfig());
    }
}
