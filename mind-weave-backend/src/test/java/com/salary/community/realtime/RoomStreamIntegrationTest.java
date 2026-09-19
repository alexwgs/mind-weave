package com.salary.community.realtime;

import com.salary.community.controller.CommunityController;
import com.salary.community.service.CommunityService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;

/**
 * SSE 实时流的集成测试。
 *
 * <p>必须走真实的 MVC async 生命周期：SseEmitter 的 onCompletion/onError 回调
 * 只有在 async 请求初始化之后才会触发，裸 emitter 的单测验证不了连接释放。
 */
@ExtendWith(MockitoExtension.class)
class RoomStreamIntegrationTest {

    private RealtimeProperties properties;
    private PresenceService presence;
    private InMemorySseBroadcaster broadcaster;
    private MockMvc mockMvc;

    @Mock private CommunityService communityService;

    @BeforeEach
    void setUp() {
        properties = new RealtimeProperties();
        presence = new PresenceService(properties);
        broadcaster = new InMemorySseBroadcaster(properties, presence);
        mockMvc = MockMvcBuilders.standaloneSetup(new CommunityController(communityService)).build();
        when(communityService.stream(eq(1L), any(), any()))
                .thenAnswer(invocation -> broadcaster.subscribe(
                        1L, presence.join(1L, invocation.getArgument(1), invocation.getArgument(2), true)));
    }

    @AfterEach
    void resetSecurityContext() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    /** 订阅后应进入 async 状态，并且出现在在线列表里 */
    @Test
    void subscribingStartsAnAsyncStreamAndRegistersTheViewer() throws Exception {
        mockMvc.perform(get("/api/community/public/rooms/1/stream").param("viewerId", "v1").param("nickname", "路过的风"))
                .andExpect(request().asyncStarted());

        assertEquals(1, broadcaster.connectionCount(1L));
        assertEquals(1, presence.count(1L));
        assertEquals("路过的风", presence.viewers(1L).get(0).name());
    }

    /** 客户端断开后，连接与在线条目都要被回收 */
    @Test
    void asyncCompletionReleasesTheConnection() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/community/public/rooms/1/stream")
                        .param("viewerId", "v1").param("nickname", "路过的风"))
                .andExpect(request().asyncStarted())
                .andReturn();

        assertEquals(1, presence.count(1L));
        result.getRequest().getAsyncContext().complete();

        assertEquals(0, broadcaster.connectionCount(1L));
        assertEquals(0, presence.count(1L), "断开后不应继续留在在线列表");
    }

    /** 两个连接应能收到同一次广播 */
    @Test
    void broadcastReachesAllSubscribers() throws Exception {
        mockMvc.perform(get("/api/community/public/rooms/1/stream").param("viewerId", "v1").param("nickname", "路过的风"))
                .andExpect(request().asyncStarted());
        mockMvc.perform(get("/api/community/public/rooms/1/stream").param("viewerId", "v2").param("nickname", "魏根生"))
                .andExpect(request().asyncStarted());

        broadcaster.broadcast(1L, RoomEvent.typing("v1", "路过的风"));

        assertEquals(2, broadcaster.connectionCount(1L));
        assertEquals(2, presence.count(1L));
    }
}
