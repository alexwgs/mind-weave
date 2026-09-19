package com.salary.community.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.Result;
import com.salary.community.dto.PublicPostRequest;
import com.salary.community.entity.ArticleComment;
import com.salary.community.entity.ChatMessage;
import com.salary.community.entity.ChatRoom;
import com.salary.community.entity.GuestbookEntry;
import com.salary.community.service.CommunityService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {
    private final CommunityService service;

    @GetMapping("/public/rooms")
    public Result<List<ChatRoom>> rooms() { return Result.ok(service.publicRooms()); }

    @GetMapping("/public/rooms/{roomId}/messages")
    public Result<Page<ChatMessage>> messages(@PathVariable Long roomId,
                                              @RequestParam(defaultValue = "1") int page,
                                              @RequestParam(defaultValue = "50") int size) {
        return Result.ok(service.publicMessages(roomId, page, size));
    }

    @PostMapping("/public/rooms/{roomId}/messages")
    public Result<ChatMessage> postMessage(@PathVariable Long roomId, @RequestBody PublicPostRequest body,
                                           HttpServletRequest request) {
        return Result.ok(service.postMessage(roomId, body, request));
    }

    @GetMapping("/public/guestbook")
    public Result<Page<GuestbookEntry>> guestbook(@RequestParam(defaultValue = "1") int page,
                                                  @RequestParam(defaultValue = "30") int size) {
        return Result.ok(service.publicGuestbook(page, size));
    }

    @PostMapping("/public/guestbook")
    public Result<GuestbookEntry> postGuestbook(@RequestBody PublicPostRequest body, HttpServletRequest request) {
        return Result.ok(service.postGuestbook(body, request));
    }

    @GetMapping("/public/articles/{articleId}/comments")
    public Result<Page<ArticleComment>> articleComments(@PathVariable Long articleId,
                                                        @RequestParam(defaultValue = "1") int page,
                                                        @RequestParam(defaultValue = "30") int size) {
        return Result.ok(service.publicArticleComments(articleId, page, size));
    }

    @PostMapping("/public/articles/{articleId}/comments")
    public Result<ArticleComment> postArticleComment(@PathVariable Long articleId,
                                                     @RequestBody PublicPostRequest body,
                                                     HttpServletRequest request) {
        return Result.ok(service.postArticleComment(articleId, body, request));
    }

    @GetMapping("/admin/moderation")
    public Result<?> moderation(@RequestParam String type,
                                @RequestParam(defaultValue = "PENDING") String status,
                                @RequestParam(defaultValue = "1") int page,
                                @RequestParam(defaultValue = "30") int size) {
        return Result.ok(service.moderation(type, status, page, size));
    }

    @PutMapping("/admin/moderation/{type}/{id}")
    public Result<Void> review(@PathVariable String type, @PathVariable Long id,
                               @RequestBody Map<String, String> body) {
        service.review(type, id, body.get("status"));
        return Result.ok();
    }

    @DeleteMapping("/admin/moderation/{type}/{id}")
    public Result<Void> delete(@PathVariable String type, @PathVariable Long id) {
        service.delete(type, id);
        return Result.ok();
    }

    @GetMapping("/admin/rooms")
    public Result<List<ChatRoom>> adminRooms() { return Result.ok(service.adminRooms()); }

    @PostMapping("/admin/rooms")
    public Result<ChatRoom> createRoom(@RequestBody Map<String, Object> body) {
        return Result.ok(service.createRoom(body));
    }

    @PutMapping("/admin/rooms/{id}")
    public Result<ChatRoom> updateRoom(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.ok(service.updateRoom(id, body));
    }
}
