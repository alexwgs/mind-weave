package com.salary.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.Result;
import com.salary.dto.RecordQuery;
import com.salary.entity.SalaryRecord;
import com.salary.service.SalaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/records")
@RequiredArgsConstructor
public class RecordController {
    private final SalaryService salaryService;

    @GetMapping
    public Result<Page<SalaryRecord>> page(RecordQuery q) {
        return Result.ok(salaryService.page(q));
    }

    @GetMapping("/{id}")
    public Result<SalaryRecord> detail(@PathVariable Long id) {
        return Result.ok(salaryService.detail(id));
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @PostMapping
    public Result<SalaryRecord> create(@RequestBody SalaryRecord req) {
        return Result.ok(salaryService.create(req));
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @PutMapping("/{id}")
    public Result<SalaryRecord> update(@PathVariable Long id, @RequestBody SalaryRecord req) {
        return Result.ok(salaryService.update(id, req));
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        salaryService.delete(id);
        return Result.ok();
    }
}
