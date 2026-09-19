package com.salary.toolkit.controller;

import com.salary.common.Result;
import com.salary.toolkit.entity.TkAttachment;
import com.salary.toolkit.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/tool/attachments")
@RequiredArgsConstructor
public class AttachmentController {
    private final AttachmentService attachmentService;

    @PostMapping
    public Result<TkAttachment> upload(@RequestParam("file") MultipartFile file,
                                       @RequestParam(defaultValue = "ARTICLE") String bizType,
                                       @RequestParam(required = false) Long bizId) {
        return Result.ok(attachmentService.upload(file, bizType, bizId));
    }

    @GetMapping
    public Result<List<TkAttachment>> list(@RequestParam(defaultValue = "ARTICLE") String bizType,
                                           @RequestParam(required = false) Long bizId) {
        return Result.ok(attachmentService.list(bizType, bizId));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable Long id) {
        return attachmentService.download(id);
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<Resource> content(@PathVariable Long id) {
        return attachmentService.content(id);
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        attachmentService.delete(id);
        return Result.ok();
    }
}
