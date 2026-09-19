package com.salary.community.realtime;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 在线列表与实时广播的行为约束 */
class InMemorySseBroadcasterTest {

    private final RealtimeProperties properties = new RealtimeProperties();
    private final PresenceService presence = new PresenceService(properties);
    private final InMemorySseBroadcaster broadcaster = new InMemorySseBroadcaster(properties, presence);

    @Test
    void joiningAndLeavingUpdatesTheViewerList() {
        presence.join(1L, "v1", "路过的风", true);
        presence.join(1L, "v2", "魏根生", false);

        List<Viewer> viewers = presence.viewers(1L);
        assertEquals(2, viewers.size());
        // 按昵称排序，列表顺序稳定，不会因为心跳而跳动
        assertEquals("路过的风", viewers.get(0).name());
        assertEquals("魏根生", viewers.get(1).name());
        assertTrue(viewers.get(1).guest() == false);

        presence.leave(1L, "v1");
        assertEquals(1, presence.count(1L));
        assertFalse(presence.name(1L, "v1").isPresent());
    }

    /** 订阅后连接进入房间连接表，并且能看到此前已在线的成员 */
    @Test
    void subscribeRegistersTheConnectionAndKeepsOtherViewers() {
        presence.join(1L, "v2", "魏根生", false);
        presence.join(1L, "v1", "路过的风", true);

        broadcaster.subscribe(1L, new Viewer("v1", "路过的风", true));

        assertEquals(1, broadcaster.connectionCount(1L));
        assertEquals(2, presence.viewers(1L).size(), "其他在线成员不应因为有人订阅而丢失");
        broadcaster.subscribe(1L, new Viewer("v3", "阿吉", true));
        assertEquals(2, broadcaster.connectionCount(1L));
    }

    @Test
    void broadcastingReachesEveryConnectionInTheRoom() {
        broadcaster.subscribe(1L, new Viewer("v1", "路过的风", true));
        broadcaster.subscribe(1L, new Viewer("v2", "魏根生", false));
        presence.join(1L, "v1", "路过的风", true);
        presence.join(1L, "v2", "魏根生", false);

        broadcaster.broadcast(1L, RoomEvent.typing("v1", "路过的风"));

        assertEquals(2, broadcaster.connectionCount(1L));
    }

    /** 心跳超时的僵尸连接会被淘汰，在线人数随之下降 */
    @Test
    void staleViewersArePrunedAfterTheTimeout() {
        // 用负数超时把"刚刚登记"也视作过期，专门验证淘汰路径
        properties.setViewerTimeoutSeconds(-1);
        presence.join(1L, "v1", "路过的风", true);
        assertEquals(1, presence.count(1L));

        presence.pruneStale();

        assertEquals(0, presence.count(1L));
        assertTrue(presence.viewers(1L).isEmpty());
    }
}
