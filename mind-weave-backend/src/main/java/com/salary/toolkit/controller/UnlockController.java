package com.salary.toolkit.controller;

import com.salary.common.BizException;
import com.salary.common.Result;
import com.salary.toolkit.service.SettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 敏感模块解锁配置（PIN/手势/人脸），按用户独立存储，无需管理员权限
 */
@RestController
@RequestMapping("/api/tool/unlock")
@RequiredArgsConstructor
public class UnlockController {
    private final SettingService settingService;
    private final PasswordEncoder passwordEncoder;
    private final com.salary.service.LogService logService;

    private static final List<String> TYPES = List.of("none", "pin", "gesture", "face");

    @GetMapping("/config")
    public Result<Map<String, Object>> config() {
        Map<String, Object> m = new LinkedHashMap<>();
        String type = settingService.value("unlock.type");
        m.put("type", type == null ? "none" : type);
        m.put("hasPin", settingService.value("unlock.pin") != null);
        m.put("hasGesture", settingService.value("unlock.gesture") != null);
        return Result.ok(m);
    }

    @PutMapping("/config")
    public Result<Void> save(@RequestBody Map<String, Object> body) {
        String type = body.get("type") == null ? "none" : String.valueOf(body.get("type"));
        if (!TYPES.contains(type)) throw new BizException("解锁方式不合法");
        if ("pin".equals(type)) {
            String pin = body.get("pin") == null ? null : String.valueOf(body.get("pin"));
            if (pin == null || !pin.matches("\\d{6}")) throw new BizException("PIN 码必须为 6 位数字");
            settingService.upsert("unlock.pin", passwordEncoder.encode(pin));
        }
        if ("gesture".equals(type)) {
            String g = body.get("gesture") == null ? null : String.valueOf(body.get("gesture"));
            if (g == null || g.split(",").length < 4) throw new BizException("手势至少连接 4 个点");
            settingService.upsert("unlock.gesture", passwordEncoder.encode(g));
        }
        settingService.upsert("unlock.type", type);
        logService.record(com.salary.security.SecurityUtils.currentUsername(), "UPDATE_UNLOCK", "UNLOCK", null,
                "修改解锁设置为 " + type);
        return Result.ok();
    }

    @PostMapping("/verify")
    public Result<Void> verify(@RequestBody Map<String, Object> body) {
        String type = body.get("type") == null ? "none" : String.valueOf(body.get("type"));
        String value = body.get("value") == null ? "" : String.valueOf(body.get("value"));
        String hash = settingService.value("unlock." + type);
        if (hash == null || hash.isBlank()) throw new BizException("未设置该解锁方式");
        if (!passwordEncoder.matches(value, hash)) throw new BizException("验证失败，请重试");
        return Result.ok();
    }
}
