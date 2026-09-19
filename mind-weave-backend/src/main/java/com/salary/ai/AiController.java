package com.salary.ai;

import com.salary.ai.dto.ChatRequest;
import com.salary.ai.dto.ChatResponse;
import com.salary.common.Result;
import com.salary.service.PermissionService;
import com.salary.toolkit.service.SettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {
    private final AiService aiService;
    private final SettingService settingService;
    private final PermissionService permissionService;
    private final com.salary.service.LogService logService;

    @PostMapping("/chat")
    public Result<ChatResponse> chat(@RequestBody ChatRequest req) {
        ChatResponse resp = aiService.chat(req == null ? null : req.getMessages());
        if (resp.getActions() != null && !resp.getActions().isEmpty()) {
            logService.record(com.salary.security.SecurityUtils.currentUsername(), "AI_CHAT", "AI", null,
                    "AI 助手执行 " + resp.getActions().size() + " 个操作");
        }
        return Result.ok(resp);
    }

    @GetMapping("/config")
    public Result<Map<String, Object>> config() {
        permissionService.require("settings.manage");
        return Result.ok(settingService.aiConfig());
    }

    @PostMapping("/test")
    public Result<Boolean> test(@RequestBody(required = false) Map<String, String> body) {
        permissionService.require("settings.manage");
        String key = body == null ? null : body.get("apiKey");
        String model = body == null ? null : body.get("model");
        String baseUrl = body == null ? null : body.get("baseUrl");
        return Result.ok(aiService.test(key, model, baseUrl));
    }
}
