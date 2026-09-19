package com.salary.admin;

import com.salary.common.BizException;
import com.salary.common.Result;
import com.salary.security.SecurityUtils;
import com.salary.service.LogService;
import com.salary.service.PermissionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/apis")
@RequiredArgsConstructor
public class ApiManagementController {
    private final ApiCatalogService catalogService;
    private final ApiToggleService toggleService;
    private final PermissionService permissionService;
    private final LogService logService;

    @GetMapping
    public Result<Map<String, Object>> catalog() {
        permissionService.require("apis");
        return Result.ok(catalogService.catalog());
    }

    @PostMapping("/toggle")
    public Result<Void> setEnabled(@RequestBody ToggleReq req) {
        permissionService.require("apis.manage");
        if (req == null || req.getMethod() == null || req.getPath() == null || req.getEnabled() == null)
            throw new BizException("接口、请求方法和状态必填");
        if (!catalogService.exists(req.getMethod(), req.getPath())) throw new BizException("接口不存在");
        toggleService.setEnabled(req.getMethod(), req.getPath(), req.getEnabled());
        logService.record(SecurityUtils.currentUsername(), req.getEnabled() ? "ENABLE_API" : "DISABLE_API",
                "API", null, req.getMethod().toUpperCase() + " " + req.getPath());
        return Result.ok();
    }

    @Data
    public static class ToggleReq {
        private String method;
        private String path;
        private Boolean enabled;
    }
}
