package com.salary.community.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.BizException;
import com.salary.community.dto.PublicPostRequest;
import com.salary.community.entity.ArticleComment;
import com.salary.community.entity.ChatMessage;
import com.salary.community.entity.ChatRoom;
import com.salary.community.entity.GuestbookEntry;
import com.salary.community.mapper.ArticleCommentMapper;
import com.salary.community.mapper.ChatMessageMapper;
import com.salary.community.mapper.ChatRoomMapper;
import com.salary.community.mapper.GuestbookEntryMapper;
import com.salary.entity.AppUser;
import com.salary.mapper.AppUserMapper;
import com.salary.security.SecurityUtils;
import com.salary.service.LogService;
import com.salary.service.PermissionService;
import com.salary.toolkit.entity.TkArticle;
import com.salary.toolkit.mapper.TkArticleMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class CommunityService {
    private static final String PENDING = "PENDING";
    private static final String APPROVED = "APPROVED";
    private static final long POST_INTERVAL_MILLIS = 8_000;

    private final ChatRoomMapper roomMapper;
    private final ChatMessageMapper messageMapper;
    private final GuestbookEntryMapper guestbookMapper;
    private final ArticleCommentMapper articleCommentMapper;
    private final TkArticleMapper articleMapper;
    private final AppUserMapper userMapper;
    private final PermissionService permissionService;
    private final LogService logService;
    private final Map<String, Long> recentPosts = new ConcurrentHashMap<>();

    public List<ChatRoom> publicRooms() {
        return roomMapper.selectList(new LambdaQueryWrapper<ChatRoom>()
                .eq(ChatRoom::getActive, 1)
                .orderByAsc(ChatRoom::getSortOrder)
                .orderByAsc(ChatRoom::getId));
    }

    public Page<ChatMessage> publicMessages(Long roomId, int page, int size) {
        requireActiveRoom(roomId);
        return messageMapper.selectPage(new Page<>(page, limited(size, 100)),
                new LambdaQueryWrapper<ChatMessage>()
                        .eq(ChatMessage::getRoomId, roomId)
                        .eq(ChatMessage::getStatus, APPROVED)
                        .orderByDesc(ChatMessage::getCreatedAt));
    }

    public ChatMessage postMessage(Long roomId, PublicPostRequest req, HttpServletRequest http) {
        requireActiveRoom(roomId);
        Author author = author(req);
        throttle("chat:" + roomId, req, http);
        ChatMessage item = new ChatMessage();
        item.setRoomId(roomId);
        applyAuthor(item, author);
        item.setContent(content(req, 1000));
        // 会客厅是当下的对话：发布即公开，不进审核队列，管理员可在后台删除
        item.setStatus(APPROVED);
        item.setSourceHash(sourceHash(req, http));
        item.setCreatedAt(LocalDateTime.now());
        messageMapper.insert(item);
        return item;
    }

    public Page<GuestbookEntry> publicGuestbook(int page, int size) {
        return guestbookMapper.selectPage(new Page<>(page, limited(size, 100)),
                new LambdaQueryWrapper<GuestbookEntry>()
                        .eq(GuestbookEntry::getStatus, APPROVED)
                        .orderByDesc(GuestbookEntry::getCreatedAt));
    }

    public GuestbookEntry postGuestbook(PublicPostRequest req, HttpServletRequest http) {
        Author author = author(req);
        throttle("guestbook", req, http);
        GuestbookEntry item = new GuestbookEntry();
        applyAuthor(item, author);
        item.setContent(content(req, 2000));
        item.setStatus(PENDING);
        item.setSourceHash(sourceHash(req, http));
        item.setCreatedAt(LocalDateTime.now());
        guestbookMapper.insert(item);
        return item;
    }

    public Page<ArticleComment> publicArticleComments(Long articleId, int page, int size) {
        requireCommentableArticle(articleId);
        return articleCommentMapper.selectPage(new Page<>(page, limited(size, 100)),
                new LambdaQueryWrapper<ArticleComment>()
                        .eq(ArticleComment::getArticleId, articleId)
                        .eq(ArticleComment::getStatus, APPROVED)
                        .orderByDesc(ArticleComment::getCreatedAt));
    }

    public ArticleComment postArticleComment(Long articleId, PublicPostRequest req, HttpServletRequest http) {
        requireCommentableArticle(articleId);
        Author author = author(req);
        throttle("article:" + articleId, req, http);
        ArticleComment item = new ArticleComment();
        item.setArticleId(articleId);
        applyAuthor(item, author);
        item.setContent(content(req, 1200));
        item.setStatus(PENDING);
        item.setSourceHash(sourceHash(req, http));
        item.setCreatedAt(LocalDateTime.now());
        articleCommentMapper.insert(item);
        return item;
    }

    public Page<?> moderation(String type, String status, int page, int size) {
        permissionService.require("community.manage");
        String normalized = normalizeType(type);
        String state = normalizeStatus(status, null);
        int limit = limited(size, 100);
        if ("CHAT".equals(normalized)) {
            LambdaQueryWrapper<ChatMessage> qw = new LambdaQueryWrapper<ChatMessage>().orderByDesc(ChatMessage::getCreatedAt);
            if (state != null) qw.eq(ChatMessage::getStatus, state);
            return messageMapper.selectPage(new Page<>(page, limit), qw);
        }
        if ("GUESTBOOK".equals(normalized)) {
            LambdaQueryWrapper<GuestbookEntry> qw = new LambdaQueryWrapper<GuestbookEntry>().orderByDesc(GuestbookEntry::getCreatedAt);
            if (state != null) qw.eq(GuestbookEntry::getStatus, state);
            return guestbookMapper.selectPage(new Page<>(page, limit), qw);
        }
        LambdaQueryWrapper<ArticleComment> qw = new LambdaQueryWrapper<ArticleComment>().orderByDesc(ArticleComment::getCreatedAt);
        if (state != null) qw.eq(ArticleComment::getStatus, state);
        return articleCommentMapper.selectPage(new Page<>(page, limit), qw);
    }

    @Transactional
    public void review(String type, Long id, String status) {
        permissionService.require("community.manage");
        String normalized = normalizeType(type);
        if ("CHAT".equals(normalized)) throw new BizException("会客厅消息发布即公开，无需审核，如需处理请直接删除");
        String state = normalizeStatus(status, PENDING);
        if (PENDING.equals(state)) throw new BizException("审核结果必须是通过或拒绝");
        String reviewer = SecurityUtils.currentUsername();
        LocalDateTime now = LocalDateTime.now();
        if ("GUESTBOOK".equals(normalized)) {
            GuestbookEntry item = guestbookMapper.selectById(id);
            if (item == null) throw new BizException("留言不存在");
            item.setStatus(state); item.setReviewedBy(reviewer); item.setReviewedAt(now); guestbookMapper.updateById(item);
        } else {
            ArticleComment item = articleCommentMapper.selectById(id);
            if (item == null) throw new BizException("评论不存在");
            item.setStatus(state); item.setReviewedBy(reviewer); item.setReviewedAt(now); articleCommentMapper.updateById(item);
        }
        logService.record(reviewer, "REVIEW_COMMUNITY_CONTENT", normalized, id, "审核结果=" + state);
    }

    @Transactional
    public void delete(String type, Long id) {
        permissionService.require("community.manage");
        String normalized = normalizeType(type);
        if ("CHAT".equals(normalized)) messageMapper.deleteById(id);
        else if ("GUESTBOOK".equals(normalized)) guestbookMapper.deleteById(id);
        else articleCommentMapper.deleteById(id);
        logService.record(SecurityUtils.currentUsername(), "DELETE_COMMUNITY_CONTENT", normalized, id, "删除公开互动内容");
    }

    public List<ChatRoom> adminRooms() {
        permissionService.require("community.manage");
        return roomMapper.selectList(new LambdaQueryWrapper<ChatRoom>()
                .orderByAsc(ChatRoom::getSortOrder).orderByAsc(ChatRoom::getId));
    }

    public ChatRoom createRoom(Map<String, Object> body) {
        permissionService.require("community.manage");
        String name = String.valueOf(body.getOrDefault("name", "")).trim();
        if (name.length() < 2 || name.length() > 50) throw new BizException("房间名称需要 2-50 个字符");
        ChatRoom room = new ChatRoom();
        room.setName(name);
        room.setDescription(String.valueOf(body.getOrDefault("description", "")).trim());
        room.setActive(1);
        room.setSortOrder(number(body.get("sortOrder"), 0));
        room.setCreatedBy(SecurityUtils.currentUsername());
        room.setCreatedAt(LocalDateTime.now());
        room.setUpdatedAt(LocalDateTime.now());
        roomMapper.insert(room);
        return room;
    }

    public ChatRoom updateRoom(Long id, Map<String, Object> body) {
        permissionService.require("community.manage");
        ChatRoom room = roomMapper.selectById(id);
        if (room == null) throw new BizException("房间不存在");
        if (body.containsKey("name")) {
            String name = String.valueOf(body.get("name")).trim();
            if (name.length() < 2 || name.length() > 50) throw new BizException("房间名称需要 2-50 个字符");
            room.setName(name);
        }
        if (body.containsKey("description")) room.setDescription(String.valueOf(body.get("description")).trim());
        if (body.containsKey("active")) room.setActive(Boolean.TRUE.equals(body.get("active")) || "1".equals(String.valueOf(body.get("active"))) ? 1 : 0);
        if (body.containsKey("sortOrder")) room.setSortOrder(number(body.get("sortOrder"), 0));
        room.setUpdatedAt(LocalDateTime.now());
        roomMapper.updateById(room);
        return room;
    }

    private void requireActiveRoom(Long roomId) {
        ChatRoom room = roomId == null ? null : roomMapper.selectById(roomId);
        if (room == null || !Integer.valueOf(1).equals(room.getActive())) throw new BizException("聊天室不存在或已关闭");
    }

    private void requireCommentableArticle(Long articleId) {
        TkArticle article = articleId == null ? null : articleMapper.selectById(articleId);
        if (article == null || !"PUBLISHED".equals(article.getStatus())) throw new BizException("文章不存在或未发布");
        if (!Integer.valueOf(1).equals(article.getCommentEnabled())) throw new BizException("这篇文章暂未开放评论");
    }

    private Author author(PublicPostRequest req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            AppUser user = userMapper.selectOne(new LambdaQueryWrapper<AppUser>().eq(AppUser::getUsername, auth.getName()));
            String display = user != null && user.getDisplayName() != null && !user.getDisplayName().isBlank()
                    ? user.getDisplayName().trim() : auth.getName();
            return new Author("USER", display, auth.getName());
        }
        String nickname = req == null || req.getNickname() == null ? "" : req.getNickname().trim();
        if (nickname.length() < 2 || nickname.length() > 24) throw new BizException("游客昵称需要 2-24 个字符");
        return new Author("GUEST", nickname, null);
    }

    private String content(PublicPostRequest req, int max) {
        String value = req == null || req.getContent() == null ? "" : req.getContent().trim();
        if (value.isEmpty()) throw new BizException("内容不能为空");
        if (value.length() > max) throw new BizException("内容不能超过 " + max + " 个字符");
        return value;
    }

    private void throttle(String scope, PublicPostRequest req, HttpServletRequest http) {
        String key = scope + ":" + sourceHash(req, http);
        long now = System.currentTimeMillis();
        Long before = recentPosts.put(key, now);
        if (before != null && now - before < POST_INTERVAL_MILLIS) {
            recentPosts.put(key, before);
            throw new BizException("发送得太快了，请稍后再试");
        }
        if (recentPosts.size() > 10_000) recentPosts.entrySet().removeIf(e -> now - e.getValue() > 86_400_000);
    }

    private String sourceHash(PublicPostRequest req, HttpServletRequest http) {
        String token = req == null || req.getVisitorToken() == null ? "" : req.getVisitorToken().trim();
        String raw = http.getRemoteAddr() + ":" + token;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return Integer.toHexString(raw.hashCode());
        }
    }

    private static int limited(int size, int max) { return Math.max(1, Math.min(size, max)); }
    private static int number(Object value, int fallback) {
        try { return Integer.parseInt(String.valueOf(value)); } catch (RuntimeException e) { return fallback; }
    }
    private static String normalizeType(String type) {
        String value = type == null ? "" : type.trim().toUpperCase();
        if (!List.of("CHAT", "GUESTBOOK", "ARTICLE").contains(value)) throw new BizException("不支持的内容类型");
        return value;
    }
    private static String normalizeStatus(String status, String fallback) {
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) return fallback;
        String value = status.trim().toUpperCase();
        if (!List.of(PENDING, APPROVED, "REJECTED").contains(value)) throw new BizException("不支持的审核状态");
        return value;
    }

    private static void applyAuthor(ChatMessage item, Author author) {
        item.setAuthorType(author.type()); item.setAuthorName(author.name()); item.setUsername(author.username());
    }
    private static void applyAuthor(GuestbookEntry item, Author author) {
        item.setAuthorType(author.type()); item.setAuthorName(author.name()); item.setUsername(author.username());
    }
    private static void applyAuthor(ArticleComment item, Author author) {
        item.setAuthorType(author.type()); item.setAuthorName(author.name()); item.setUsername(author.username());
    }
    private record Author(String type, String name, String username) {}
}
