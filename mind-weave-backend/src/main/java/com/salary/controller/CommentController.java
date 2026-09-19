package com.salary.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.Result;
import com.salary.dto.CommentDTO;
import com.salary.dto.CommentRequest;
import com.salary.service.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/comments")
@RequiredArgsConstructor
public class CommentController {
    private final CommentService commentService;

    @GetMapping
    public Result<Page<CommentDTO>> page(@RequestParam(defaultValue = "1") int page,
                                         @RequestParam(defaultValue = "10") int size,
                                         @RequestParam(required = false) Integer year,
                                         @RequestParam(required = false) String fieldCode,
                                         @RequestParam(required = false) String keyword) {
        return Result.ok(commentService.page(page, size, year, fieldCode, keyword));
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @PostMapping
    public Result<CommentDTO> create(@Valid @RequestBody CommentRequest req) {
        return Result.ok(commentService.create(req));
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @PutMapping("/{id}")
    public Result<CommentDTO> update(@PathVariable Long id, @Valid @RequestBody CommentRequest req) {
        return Result.ok(commentService.update(id, req));
    }

    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        commentService.delete(id);
        return Result.ok();
    }
}
