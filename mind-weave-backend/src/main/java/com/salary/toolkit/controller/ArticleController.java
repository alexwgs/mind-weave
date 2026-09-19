package com.salary.toolkit.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.Result;
import com.salary.toolkit.dto.ArticleReq;
import com.salary.toolkit.dto.ShareReq;
import com.salary.toolkit.entity.ArticleCategory;
import com.salary.toolkit.entity.TkArticle;
import com.salary.toolkit.service.ArticleService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tool")
@RequiredArgsConstructor
public class ArticleController {
    private final ArticleService articleService;

    @Data
    public static class CategoryReq {
        private String name;
        private Long parentId;
        private Integer sortOrder;
    }

    // 分类
    @GetMapping("/categories")
    public Result<List<ArticleCategory>> categories() {
        return Result.ok(articleService.listCategories());
    }

    @PostMapping("/categories")
    public Result<ArticleCategory> createCategory(@RequestBody CategoryReq req) {
        return Result.ok(articleService.createCategory(req.getName(), req.getParentId(), req.getSortOrder()));
    }

    @PutMapping("/categories/{id}")
    public Result<ArticleCategory> updateCategory(@PathVariable Long id, @RequestBody CategoryReq req) {
        return Result.ok(articleService.updateCategory(id, req.getName(), req.getParentId(), req.getSortOrder()));
    }

    @DeleteMapping("/categories/{id}")
    public Result<Void> deleteCategory(@PathVariable Long id) {
        articleService.deleteCategory(id);
        return Result.ok();
    }

    // 文章
    @GetMapping("/articles")
    public Result<Page<TkArticle>> page(@RequestParam(defaultValue = "1") int page,
                                        @RequestParam(defaultValue = "20") int size,
                                        @RequestParam(required = false) String status,
                                        @RequestParam(required = false) Long categoryId,
                                        @RequestParam(required = false) String tag,
                                        @RequestParam(required = false) String keyword,
                                        @RequestParam(required = false) String sortField,
                                        @RequestParam(required = false) String sortOrder) {
        return Result.ok(articleService.page(page, size, status, categoryId, tag, keyword, sortField, sortOrder));
    }

    @GetMapping("/articles/{id}")
    public Result<TkArticle> detail(@PathVariable Long id) {
        return Result.ok(articleService.detail(id));
    }

    @GetMapping("/articles/public")
    public Result<Page<TkArticle>> publicPage(@RequestParam(defaultValue = "1") int page,
                                              @RequestParam(defaultValue = "12") int size,
                                              @RequestParam(required = false) Long categoryId,
                                              @RequestParam(required = false) String keyword,
                                              @RequestParam(required = false) String sortField,
                                              @RequestParam(required = false) String sortOrder) {
        return Result.ok(articleService.publicPage(page, size, categoryId, keyword, sortField, sortOrder));
    }

    @GetMapping("/articles/public/categories")
    public Result<List<Map<String, Object>>> publicCategories() {
        return Result.ok(articleService.publicCategories());
    }

    @GetMapping("/articles/covers")
    public Result<List<Map<String, Object>>> covers(@RequestParam(defaultValue = "6") int limit,
                                                    @RequestParam(defaultValue = "true") boolean carousel) {
        return Result.ok(articleService.listCovers(limit, carousel));
    }

    @GetMapping("/articles/public/{id}")
    public Result<TkArticle> publicDetail(@PathVariable Long id) {
        return Result.ok(articleService.publicDetail(id));
    }

    @PostMapping("/articles")
    public Result<TkArticle> create(@RequestBody ArticleReq req) {
        return Result.ok(articleService.create(req));
    }

    @PutMapping("/articles/{id}")
    public Result<TkArticle> update(@PathVariable Long id, @RequestBody ArticleReq req) {
        return Result.ok(articleService.update(id, req));
    }

    @DeleteMapping("/articles/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        articleService.delete(id);
        return Result.ok();
    }

    @PostMapping("/articles/{id}/share")
    public Result<TkArticle> share(@PathVariable Long id, @RequestBody(required = false) ShareReq req) {
        return Result.ok(articleService.share(id, req == null ? new ShareReq() : req));
    }

    @DeleteMapping("/articles/{id}/share")
    public Result<Void> disableShare(@PathVariable Long id) {
        articleService.disableShare(id);
        return Result.ok();
    }
}
