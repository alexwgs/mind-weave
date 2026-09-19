package com.salary.controller;

import com.salary.common.Result;
import com.salary.entity.Permission;
import com.salary.service.PermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/permissions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class PermissionController {
    private final PermissionService permissionService;

    @GetMapping
    public Result<List<Permission>> list() {
        return Result.ok(permissionService.listAll());
    }

    @GetMapping("/roles")
    public Result<Map<String, List<String>>> roleDefaults() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("ADMIN", permissionService.rolePermissions("ADMIN"));
        map.put("MANAGER", permissionService.rolePermissions("MANAGER"));
        map.put("USER", permissionService.rolePermissions("USER"));
        return Result.ok(map);
    }
}
