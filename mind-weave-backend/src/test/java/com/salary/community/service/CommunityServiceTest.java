package com.salary.community.service;

import com.salary.common.BizException;
import com.salary.community.dto.PublicPostRequest;
import com.salary.community.entity.ChatMessage;
import com.salary.community.entity.ChatRoom;
import com.salary.community.entity.GuestbookEntry;
import com.salary.community.mapper.ArticleCommentMapper;
import com.salary.community.mapper.ChatMessageMapper;
import com.salary.community.mapper.ChatRoomMapper;
import com.salary.community.mapper.GuestbookEntryMapper;
import com.salary.community.realtime.PresenceService;
import com.salary.community.realtime.RealtimeBroadcaster;
import com.salary.community.realtime.RoomEvent;
import com.salary.community.realtime.Viewer;
import com.salary.entity.AppUser;
import com.salary.mapper.AppUserMapper;
import com.salary.security.SecurityUtils;
import com.salary.service.LogService;
import com.salary.service.PermissionService;
import com.salary.toolkit.mapper.TkArticleMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 会客厅：发布即公开、无需审核，管理员仍可删除。
 * 留言板与文章评论保持先审后发。
 */
@ExtendWith(MockitoExtension.class)
class CommunityServiceTest {

    @Mock private ChatRoomMapper roomMapper;
    @Mock private ChatMessageMapper messageMapper;
    @Mock private GuestbookEntryMapper guestbookMapper;
    @Mock private ArticleCommentMapper articleCommentMapper;
    @Mock private TkArticleMapper articleMapper;
    @Mock private AppUserMapper userMapper;
    @Mock private PermissionService permissionService;
    @Mock private LogService logService;
    @Mock private RealtimeBroadcaster broadcaster;
    @Mock private PresenceService presence;

    @InjectMocks private CommunityService service;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static PublicPostRequest request(String nickname, String content, String token) {
        PublicPostRequest req = new PublicPostRequest();
        req.setNickname(nickname);
        req.setContent(content);
        req.setVisitorToken(token);
        return req;
    }

    private void activeRoom(long roomId) {
        ChatRoom room = new ChatRoom();
        room.setId(roomId);
        room.setName("技术闲聊");
        room.setActive(1);
        when(roomMapper.selectById(roomId)).thenReturn(room);
    }

    @Test
    void chatMessageIsPublishedImmediatelyWithoutReview() {
        activeRoom(1L);
        service.postMessage(1L, request("路过的风", "先占个座", "visitor-chat-1"), new MockHttpServletRequest());

        ArgumentCaptor<ChatMessage> saved = ArgumentCaptor.forClass(ChatMessage.class);
        verify(messageMapper).insert(saved.capture());
        ChatMessage message = saved.getValue();
        assertEquals("APPROVED", message.getStatus(), "会客厅消息应当发布即公开");
        assertEquals("路过的风", message.getAuthorName());
        assertEquals("GUEST", message.getAuthorType());
        assertEquals(1L, message.getRoomId());
    }

    /** 落库成功后必须立刻广播，前端才能不刷新就看到新消息 */
    @Test
    void postingAMessageBroadcastsItToTheRoom() {
        activeRoom(1L);
        ChatMessage saved = service.postMessage(1L, request("阿吉", "压到 24 秒了", "visitor-broadcast-1"), new MockHttpServletRequest());

        ArgumentCaptor<RoomEvent> event = ArgumentCaptor.forClass(RoomEvent.class);
        verify(broadcaster).broadcast(eq(1L), event.capture());
        assertEquals("message", event.getValue().kind());
        assertEquals(saved.getId(), event.getValue().message().getId());
        assertEquals("APPROVED", event.getValue().message().getStatus());
    }

    /** 成员身份在请求线程内同步解析，异步推流阶段不再依赖 SecurityContext */
    @Test
    void streamResolvesMemberIdentityFromSecurityContext() {
        activeRoom(1L);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("wei", null, java.util.List.of()));
        AppUser user = new AppUser();
        user.setUsername("wei");
        user.setDisplayName("魏根生");
        when(userMapper.selectOne(any())).thenReturn(user);
        when(presence.join(eq(1L), eq("viewer-1"), eq("魏根生"), eq(false)))
                .thenReturn(new Viewer("viewer-1", "魏根生", false));
        when(broadcaster.subscribe(eq(1L), any())).thenReturn(new SseEmitter());

        service.stream(1L, "viewer-1", "游客昵称不该被采用");

        ArgumentCaptor<Viewer> viewer = ArgumentCaptor.forClass(Viewer.class);
        verify(broadcaster).subscribe(eq(1L), viewer.capture());
        assertEquals("魏根生", viewer.getValue().name(), "登录用户应使用账号展示名");
        assertEquals(false, viewer.getValue().guest());
        assertEquals("viewer-1", viewer.getValue().id());
    }

    @Test
    void streamFallsBackToGuestNickname() {
        activeRoom(1L);
        when(presence.join(eq(1L), eq("viewer-2"), eq("路过的风"), eq(true)))
                .thenReturn(new Viewer("viewer-2", "路过的风", true));
        when(broadcaster.subscribe(eq(1L), any())).thenReturn(new SseEmitter());

        service.stream(1L, "viewer-2", "路过的风");

        ArgumentCaptor<Viewer> viewer = ArgumentCaptor.forClass(Viewer.class);
        verify(broadcaster).subscribe(eq(1L), viewer.capture());
        assertEquals("路过的风", viewer.getValue().name());
        assertEquals(true, viewer.getValue().guest());
    }

    /** 输入中提示限流：连续按键只广播一次，避免刷屏 */
    @Test
    void typingIsThrottledPerViewer() {
        activeRoom(1L);
        when(presence.name(1L, "viewer-1")).thenReturn(java.util.Optional.of("路过的风"));

        service.typing(1L, "viewer-1");
        service.typing(1L, "viewer-1");
        service.typing(1L, "viewer-1");

        verify(broadcaster).broadcast(eq(1L), any(RoomEvent.class));
    }

    @Test
    void guestbookStillWaitsForReview() {
        service.postGuestbook(request("木棉", "希望一直都在", "visitor-book-1"), new MockHttpServletRequest());

        ArgumentCaptor<GuestbookEntry> saved = ArgumentCaptor.forClass(GuestbookEntry.class);
        verify(guestbookMapper).insert(saved.capture());
        assertEquals("PENDING", saved.getValue().getStatus(), "留言板仍应先审后发");
    }

    @Test
    void chatMessageRejectsReviewButAllowsDelete() {
        BizException error = assertThrows(BizException.class, () -> service.review("CHAT", 7L, "APPROVED"));
        assertTrue(error.getMessage().contains("无需审核"), "应说明会客厅不需要审核，实际：" + error.getMessage());
        verify(messageMapper, never()).selectById(any());
        verify(messageMapper, never()).updateById(any(ChatMessage.class));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", null, java.util.List.of()));
        service.delete("CHAT", 7L);
        verify(messageMapper).deleteById(7L);
        verify(logService).record(eq(SecurityUtils.currentUsername()), eq("DELETE_COMMUNITY_CONTENT"), eq("CHAT"), eq(7L), any());
    }

    @Test
    void guestbookReviewStillWorks() {
        GuestbookEntry entry = new GuestbookEntry();
        entry.setId(5L);
        entry.setStatus("PENDING");
        when(guestbookMapper.selectById(5L)).thenReturn(entry);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", null, java.util.List.of()));

        service.review("GUESTBOOK", 5L, "APPROVED");

        assertEquals("APPROVED", entry.getStatus());
        assertEquals("admin", entry.getReviewedBy());
        verify(guestbookMapper).updateById(entry);
    }
}
