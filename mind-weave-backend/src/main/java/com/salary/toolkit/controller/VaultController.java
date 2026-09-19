package com.salary.toolkit.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.Result;
import com.salary.toolkit.dto.PinReq;
import com.salary.toolkit.dto.RevealVO;
import com.salary.toolkit.dto.VaultItemReq;
import com.salary.toolkit.dto.VaultItemVO;
import com.salary.toolkit.entity.VaultGroup;
import com.salary.toolkit.service.VaultService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tool/vault")
@RequiredArgsConstructor
public class VaultController {
    private final VaultService vaultService;

    @Data
    public static class GroupReq {
        private String name;
        private Integer sortOrder;
    }

    // 分组
    @GetMapping("/groups")
    public Result<List<VaultGroup>> groups() {
        return Result.ok(vaultService.listGroups());
    }

    @GetMapping("/groups/summary")
    public Result<List<Map<String, Object>>> groupSummary() {
        return Result.ok(vaultService.groupSummary());
    }

    @PostMapping("/groups")
    public Result<VaultGroup> createGroup(@RequestBody GroupReq req) {
        return Result.ok(vaultService.createGroup(req.getName(), req.getSortOrder()));
    }

    @PutMapping("/groups/{id}")
    public Result<VaultGroup> updateGroup(@PathVariable Long id, @RequestBody GroupReq req) {
        return Result.ok(vaultService.updateGroup(id, req.getName(), req.getSortOrder()));
    }

    @DeleteMapping("/groups/{id}")
    public Result<Void> deleteGroup(@PathVariable Long id) {
        vaultService.deleteGroup(id);
        return Result.ok();
    }

    // 凭证条目
    @GetMapping("/items")
    public Result<Page<VaultItemVO>> items(@RequestParam(defaultValue = "1") int page,
                                           @RequestParam(defaultValue = "20") int size,
                                           @RequestParam(required = false) Long groupId,
                                           @RequestParam(required = false) String keyword) {
        return Result.ok(vaultService.pageItems(page, size, groupId, keyword));
    }

    @GetMapping("/items/{id}")
    public Result<VaultItemVO> detail(@PathVariable Long id) {
        return Result.ok(vaultService.detail(id));
    }

    @GetMapping("/items/{id}/reveal")
    public Result<RevealVO> reveal(@PathVariable Long id) {
        return Result.ok(vaultService.reveal(id));
    }

    @PostMapping("/items")
    public Result<VaultItemVO> create(@RequestBody VaultItemReq req) {
        return Result.ok(vaultService.create(req));
    }

    @PutMapping("/items/{id}")
    public Result<VaultItemVO> update(@PathVariable Long id, @RequestBody VaultItemReq req) {
        return Result.ok(vaultService.update(id, req));
    }

    @DeleteMapping("/items/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        vaultService.delete(id);
        return Result.ok();
    }

    // PIN
    @PutMapping("/pin")
    public Result<Void> setPin(@RequestBody PinReq req) {
        vaultService.setPin(req.getPin());
        return Result.ok();
    }

    @PostMapping("/pin/verify")
    public Result<Void> verifyPin(@RequestBody PinReq req) {
        vaultService.verifyPin(req.getPin());
        return Result.ok();
    }
}
