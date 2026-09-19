package com.salary.community.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 在线状态登记表（内存实现）。
 *
 * <p>在线 = 该 viewer 在当前房间持有存活的 SSE 连接。心跳通过刷新
 * {@code lastSeen} 维持，连接建立/断开直接增删，另有定时任务淘汰
 * 心跳超时的僵尸条目（例如拔网线来不及触发断开事件的情况）。
 *
 * <p>这是有意的内存态设计：在线列表是易失数据，重启即清空，不应污染数据库。
 * 将来若要多实例部署，可把这份状态搬到 Redis，接口保持不变。
 */
@Service
@RequiredArgsConstructor
public class PresenceService {
    private final RealtimeProperties properties;
    private final Map<Long, Map<String, Entry>> rooms = new ConcurrentHashMap<>();

    private static final class Entry {
        private final String name;
        private final boolean guest;
        private volatile long lastSeen;

        private Entry(String name, boolean guest, long lastSeen) {
            this.name = name;
            this.guest = guest;
            this.lastSeen = lastSeen;
        }
    }

    public Viewer join(Long roomId, String viewerId, String name, boolean guest) {
        String trimmed = name == null || name.isBlank() ? "访客" : name.trim();
        rooms.computeIfAbsent(roomId, key -> new ConcurrentHashMap<>())
                .put(viewerId, new Entry(trimmed, guest, System.currentTimeMillis()));
        return new Viewer(viewerId, trimmed, guest);
    }

    public void touch(Long roomId, String viewerId) {
        Entry entry = entry(roomId, viewerId);
        if (entry != null) entry.lastSeen = System.currentTimeMillis();
    }

    public void leave(Long roomId, String viewerId) {
        Map<String, Entry> room = rooms.get(roomId);
        if (room == null) return;
        room.remove(viewerId);
        if (room.isEmpty()) rooms.remove(roomId, room);
    }

    public List<Viewer> viewers(Long roomId) {
        Map<String, Entry> room = rooms.get(roomId);
        if (room == null || room.isEmpty()) return List.of();
        List<Viewer> result = new ArrayList<>(room.size());
        room.forEach((id, entry) -> result.add(new Viewer(id, entry.name, entry.guest)));
        result.sort((left, right) -> left.name().compareTo(right.name()));
        return result;
    }

    /** 在线人数，用于空房间时跳过无意义的心跳广播 */
    public int count(Long roomId) {
        Map<String, Entry> room = rooms.get(roomId);
        return room == null ? 0 : room.size();
    }

    public Optional<String> name(Long roomId, String viewerId) {
        Entry entry = entry(roomId, viewerId);
        return entry == null ? Optional.empty() : Optional.of(entry.name);
    }

    /** 淘汰心跳超时的僵尸条目，返回仍有人在线的房间号 */
    public List<Long> pruneStale() {
        long deadline = System.currentTimeMillis() - properties.getViewerTimeoutSeconds() * 1000L;
        List<Long> active = new ArrayList<>();
        rooms.forEach((roomId, room) -> {
            room.entrySet().removeIf(entry -> entry.getValue().lastSeen < deadline);
            if (!room.isEmpty()) active.add(roomId);
        });
        rooms.entrySet().removeIf(entry -> entry.getValue().isEmpty());
        return active;
    }

    public Set<Long> roomIds() {
        return Collections.unmodifiableSet(rooms.keySet());
    }

    private Entry entry(Long roomId, String viewerId) {
        Map<String, Entry> room = rooms.get(roomId);
        return room == null ? null : room.get(viewerId);
    }
}
