package com.salary.community.realtime;

import com.salary.community.entity.ChatMessage;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 默认实时实现：单实例内存扇出 + SSE 推送。
 *
 * <p>浏览器用 EventSource 连到 {@code /api/community/public/rooms/{id}/stream}，
 * 之后新消息、在线列表变化、输入中提示都通过同一条长连接下发。
 *
 * <p>连接表同样保存在内存：单实例部署下这已经够用，而且比引 Kafka 更简单可靠。
 * 需要多实例或外部订阅时，用 Kafka 版实现替换本类即可（见 {@link RealtimeBroadcaster}）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "community.realtime", name = "enabled", havingValue = "true", matchIfMissing = true)
public class InMemorySseBroadcaster implements RealtimeBroadcaster {

    private final RealtimeProperties properties;
    private final PresenceService presence;
    private final Map<Long, Map<String, SseEmitter>> subscriptions = new ConcurrentHashMap<>();
    private final List<RoomEventListener> listeners = new CopyOnWriteArrayList<>();
    private final ScheduledExecutorService cleanup = Executors.newSingleThreadScheduledExecutor(task -> {
        Thread thread = new Thread(task, "community-sse-cleanup");
        thread.setDaemon(true);
        return thread;
    });

    @Override
    public SseEmitter subscribe(Long roomId, Viewer viewer) {
        SseEmitter emitter = new SseEmitter(properties.getStreamTimeoutSeconds() * 1000L);
        subscriptions.computeIfAbsent(roomId, key -> new ConcurrentHashMap<>()).put(viewer.id(), emitter);
        // 订阅即上线：不依赖调用方是否已经登记过，避免出现"有连接但不在在线列表"
        presence.join(roomId, viewer.id(), viewer.name(), viewer.guest());

        emitter.onCompletion(() -> drop(roomId, viewer.id(), false));
        emitter.onTimeout(() -> {
            drop(roomId, viewer.id(), false);
            emitter.complete();
        });
        emitter.onError(error -> drop(roomId, viewer.id(), false));

        // 首帧必须延后发送：此刻 controller 还没把 emitter 交给 Spring，
        // 同步 send 会让 async 上下文提前结束，浏览器收到的是空响应。
        cleanup.schedule(() -> sendInitialFrame(roomId, viewer), 30, TimeUnit.MILLISECONDS);
        // 新成员加入，房间内所有人的在线列表都要刷新
        notifyListeners(roomId, RoomEvent.presence(viewer.id(), viewer.name(), true));
        return emitter;
    }

    private void sendInitialFrame(Long roomId, Viewer viewer) {
        Map<String, SseEmitter> room = subscriptions.get(roomId);
        SseEmitter emitter = room == null ? null : room.get(viewer.id());
        if (emitter == null) return;
        if (!sendFrame(roomId, viewer.id(), emitter, null)) {
            cleanup.schedule(() -> drop(roomId, viewer.id(), false), 2, TimeUnit.SECONDS);
        }
    }

    @Override
    public void broadcast(Long roomId, RoomEvent event) {
        Map<String, SseEmitter> room = subscriptions.get(roomId);
        if (room == null || room.isEmpty()) return;
        List<String> dead = new ArrayList<>();
        // 先发完再清理：避免在遍历连接表的过程中修改它（会重入广播）
        room.forEach((viewerId, emitter) -> {
            if (!sendFrame(roomId, viewerId, emitter, event)) dead.add(viewerId);
        });
        dead.forEach(viewerId -> drop(roomId, viewerId, true));
    }

    @Override
    public void heartbeat(Long roomId) {
        if (presence.count(roomId) == 0) return;
        broadcast(roomId, null);
    }

    @Override
    public void complete(Long roomId) {
        Map<String, SseEmitter> room = subscriptions.remove(roomId);
        if (room == null) return;
        room.values().forEach(SseEmitter::complete);
    }

    @Override
    public void addListener(RoomEventListener listener) {
        listeners.add(listener);
    }

    @Override
    public void onViewersChanged(Long roomId) {
        broadcast(roomId, null);
    }

    /** 保活心跳：顺带刷新在线列表，并按房间清理已死连接 */
    @Scheduled(fixedRateString = "${community.realtime.heartbeat-seconds:20}000")
    public void heartbeatAll() {
        subscriptions.keySet().forEach(this::heartbeat);
    }

    /**
     * 发送一帧。返回 false 表示连接已不可用，由调用方在遍历结束后统一清理，
     * 避免在遍历连接表的过程中修改它而触发重入广播。
     */
    private boolean sendFrame(Long roomId, String viewerId, SseEmitter emitter, RoomEvent event) {
        try {
            emitter.send(SseEmitter.event().name("room").data(new RoomEventPayload(presence.viewers(roomId), event)));
            return true;
        } catch (IOException | IllegalStateException e) {
            try {
                emitter.completeWithError(e);
            } catch (RuntimeException ignored) {
                // 连接可能已经结束，忽略
            }
            return false;
        }
    }

    private void drop(Long roomId, String viewerId, boolean notify) {
        Map<String, SseEmitter> room = subscriptions.get(roomId);
        if (room == null) return;
        if (room.remove(viewerId) == null) return;
        if (room.isEmpty()) subscriptions.remove(roomId, room);
        presence.leave(roomId, viewerId);
        if (notify) notifyListeners(roomId, RoomEvent.presence(viewerId, null, false));
    }

    private void notifyListeners(Long roomId, RoomEvent event) {
        listeners.forEach(listener -> listener.onRoomEvent(roomId, event));
    }

    /** 供测试与诊断：当前房间的活跃连接数 */
    public int connectionCount(Long roomId) {
        Map<String, SseEmitter> room = subscriptions.get(roomId);
        return room == null ? 0 : room.size();
    }

    /** 停机时主动关闭所有长连接，让浏览器立刻知道要重连，而不是一直挂着 */
    @PreDestroy
    void shutdown() {
        subscriptions.keySet().forEach(this::complete);
        cleanup.shutdownNow();
    }
}