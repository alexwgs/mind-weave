package com.salary.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.Result;
import com.salary.dto.ImportPreview;
import com.salary.dto.ImportResult;
import com.salary.entity.ImportBatch;
import com.salary.mapper.ImportBatchMapper;
import com.salary.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
public class ImportController {
    private final ImportService importService;
    private final ImportBatchMapper batchMapper;

    @PostMapping("/preview")
    public Result<ImportPreview> preview(@RequestParam("file") MultipartFile file) {
        return Result.ok(importService.preview(file));
    }

    @PostMapping("/execute")
    public Result<ImportResult> execute(@RequestParam("file") MultipartFile file,
                                        @RequestParam(defaultValue = "append") String mode) {
        return Result.ok(importService.execute(file, mode));
    }

    @GetMapping("/batches")
    public Result<Page<ImportBatch>> batches(@RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "10") int size) {
        return Result.ok(batchMapper.selectPage(new Page<>(page, size),
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<ImportBatch>()
                        .orderByDesc(ImportBatch::getId)));
    }
}
