package com.salary.community.realtime;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 会客厅在线状态。
 *
 * <p>本地开发默认使用内存；生产可通过
 * {@code COMMUNITY_PRESENCE_STORE=redis} 切换到 Redis。Redis 使用 Hash 保存
 * 展示信息、Sorted Set 保存最后心跳时间，既支持单个 viewer 过期，也能让多个
 * MindWeave 实例共享同一份在线列表。</p>
 */
@Slf4j
@Service
public class PresenceService {
    private final RealtimeProperties properties;
    private final StringRedisTemplate redis;
    private final boolean useRedis;
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

    /** 纯单元测试和不启用 Spring Redis 时使用。 */
    public PresenceService(RealtimeProperties properties) {
        this.properties = properties;
        this.redis = null;
        this.useRedis = false;
    }

    @Autowired
    public PresenceService(RealtimeProperties properties, ObjectProvider<StringRedisTemplate> redisProvider) {
        this.properties = properties;
        this.useRedis = "redis".equalsIgnoreCase(properties.getPresenceStore());
        this.redis = useRedis ? redisProvider.getIfAvailable() : null;
        if (useRedis && redis == null) {
            throw new IllegalStateException("community.realtime.presence-store=redis，但 Redis 客户端未配置");
        }
        log.info("会客厅 Presence 存储：{}", useRedis ? "Redis" : "本地内存");
    }

    public Viewer join(Long roomId, String viewerId, String name, boolean guest) {
        requireIdentity(roomId, viewerId);
        String trimmed = name == null || name.isBlank() ? "访客" : name.trim();
        long now = System.currentTimeMillis();
        if (useRedis) {
            redis.opsForHash().put(detailKey(roomId), viewerId, encode(trimmed, guest));
            redis.opsForZSet().add(seenKey(roomId), viewerId, now);
            redis.opsForSet().add(roomsKey(), roomId.toString());
            refreshExpiry(roomId);
        } else {
            rooms.computeIfAbsent(roomId, key -> new ConcurrentHashMap<>())
                    .put(viewerId, new Entry(trimmed, guest, now));
        }
        return new Viewer(viewerId, trimmed, guest);
    }

    public void touch(Long roomId, String viewerId) {
        if (roomId == null || viewerId == null || viewerId.isBlank()) return;
        if (useRedis) {
            if (Boolean.TRUE.equals(redis.opsForHash().hasKey(detailKey(roomId), viewerId))) {
                redis.opsForZSet().add(seenKey(roomId), viewerId, System.currentTimeMillis());
                refreshExpiry(roomId);
            }
            return;
        }
        Entry entry = entry(roomId, viewerId);
        if (entry != null) entry.lastSeen = System.currentTimeMillis();
    }

    public void leave(Long roomId, String viewerId) {
        if (roomId == null || viewerId == null || viewerId.isBlank()) return;
        if (useRedis) {
            redis.opsForHash().delete(detailKey(roomId), viewerId);
            redis.opsForZSet().remove(seenKey(roomId), viewerId);
            removeRoomMarkerIfEmpty(roomId);
            return;
        }
        Map<String, Entry> room = rooms.get(roomId);
        if (room == null) return;
        room.remove(viewerId);
        if (room.isEmpty()) rooms.remove(roomId, room);
    }

    public List<Viewer> viewers(Long roomId) {
        if (roomId == null) return List.of();
        if (useRedis) return redisViewers(roomId);
        Map<String, Entry> room = rooms.get(roomId);
        if (room == null || room.isEmpty()) return List.of();
        List<Viewer> result = new ArrayList<>(room.size());
        room.forEach((id, entry) -> result.add(new Viewer(id, entry.name, entry.guest)));
        sort(result);
        return result;
    }

    public int count(Long roomId) {
        if (roomId == null) return 0;
        if (useRedis) {
            removeExpiredRedis(roomId);
            Long count = redis.opsForZSet().zCard(seenKey(roomId));
            return count == null ? 0 : count.intValue();
        }
        Map<String, Entry> room = rooms.get(roomId);
        return room == null ? 0 : room.size();
    }

    public Optional<String> name(Long roomId, String viewerId) {
        if (roomId == null || viewerId == null) return Optional.empty();
        if (useRedis) {
            removeExpiredRedis(roomId);
            Object value = redis.opsForHash().get(detailKey(roomId), viewerId);
            Viewer viewer = decode(viewerId, value == null ? null : value.toString());
            return viewer == null ? Optional.empty() : Optional.of(viewer.name());
        }
        Entry entry = entry(roomId, viewerId);
        return entry == null ? Optional.empty() : Optional.of(entry.name);
    }

    public Optional<Viewer> viewer(Long roomId, String viewerId) {
        if (roomId == null || viewerId == null) return Optional.empty();
        if (useRedis) {
            removeExpiredRedis(roomId);
            Object value = redis.opsForHash().get(detailKey(roomId), viewerId);
            return Optional.ofNullable(decode(viewerId, value == null ? null : value.toString()));
        }
        Entry entry = entry(roomId, viewerId);
        return entry == null ? Optional.empty() : Optional.of(new Viewer(viewerId, entry.name, entry.guest));
    }

    /** 淘汰心跳超时条目，返回在线列表发生变化且仍有人在线的房间。 */
    public List<Long> pruneStale() {
        if (useRedis) {
            List<Long> changed = new ArrayList<>();
            for (Long roomId : redisRoomIds()) {
                long removed = removeExpiredRedis(roomId);
                if (removed > 0 && count(roomId) > 0) changed.add(roomId);
            }
            return changed;
        }
        long deadline = deadline();
        List<Long> changed = new ArrayList<>();
        rooms.forEach((roomId, room) -> {
            int before = room.size();
            room.entrySet().removeIf(entry -> entry.getValue().lastSeen < deadline);
            if (room.size() < before && !room.isEmpty()) changed.add(roomId);
        });
        rooms.entrySet().removeIf(entry -> entry.getValue().isEmpty());
        return changed;
    }

    public Set<Long> roomIds() {
        return useRedis ? Collections.unmodifiableSet(redisRoomIds()) : Collections.unmodifiableSet(rooms.keySet());
    }

    public boolean redisBacked() {
        return useRedis;
    }

    private List<Viewer> redisViewers(Long roomId) {
        removeExpiredRedis(roomId);
        Set<String> ids = redis.opsForZSet().range(seenKey(roomId), 0, -1);
        if (ids == null || ids.isEmpty()) return List.of();
        List<String> orderedIds = new ArrayList<>(ids);
        List<Object> hashKeys = new ArrayList<>();
        hashKeys.addAll(orderedIds);
        List<Object> values = redis.opsForHash().multiGet(detailKey(roomId), hashKeys);
        List<Viewer> result = new ArrayList<>();
        for (int i = 0; i < orderedIds.size(); i++) {
            Object value = values != null && i < values.size() ? values.get(i) : null;
            Viewer viewer = decode(orderedIds.get(i), value == null ? null : value.toString());
            if (viewer != null) result.add(viewer);
        }
        sort(result);
        return result;
    }

    private long removeExpiredRedis(Long roomId) {
        Set<String> stale = redis.opsForZSet().rangeByScore(seenKey(roomId), Double.NEGATIVE_INFINITY, deadline());
        if (stale == null || stale.isEmpty()) {
            removeRoomMarkerIfEmpty(roomId);
            return 0;
        }
        redis.opsForZSet().remove(seenKey(roomId), stale.toArray());
        redis.opsForHash().delete(detailKey(roomId), stale.toArray());
        removeRoomMarkerIfEmpty(roomId);
        return stale.size();
    }

    private void removeRoomMarkerIfEmpty(Long roomId) {
        Long count = redis.opsForZSet().zCard(seenKey(roomId));
        if (count == null || count == 0) {
            redis.opsForSet().remove(roomsKey(), roomId.toString());
            redis.delete(detailKey(roomId));
            redis.delete(seenKey(roomId));
        }
    }

    private Set<Long> redisRoomIds() {
        Set<String> values = redis.opsForSet().members(roomsKey());
        if (values == null || values.isEmpty()) return Set.of();
        Set<Long> result = new HashSet<>();
        for (String value : values) {
            try { result.add(Long.parseLong(value)); } catch (NumberFormatException ignored) { /* ignore corrupt marker */ }
        }
        return result;
    }

    private void refreshExpiry(Long roomId) {
        Duration ttl = Duration.ofSeconds(Math.max(120, properties.getViewerTimeoutSeconds() * 4L));
        redis.expire(detailKey(roomId), ttl);
        redis.expire(seenKey(roomId), ttl);
    }

    private long deadline() {
        return System.currentTimeMillis() - properties.getViewerTimeoutSeconds() * 1000L;
    }

    private String roomsKey() { return properties.getRedisKeyPrefix() + ":rooms"; }
    private String detailKey(Long roomId) { return properties.getRedisKeyPrefix() + ":room:" + roomId + ":viewers"; }
    private String seenKey(Long roomId) { return properties.getRedisKeyPrefix() + ":room:" + roomId + ":seen"; }

    private static String encode(String name, boolean guest) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(name.getBytes(StandardCharsets.UTF_8)) + "|" + (guest ? "1" : "0");
    }

    private static Viewer decode(String id, String value) {
        if (value == null) return null;
        int split = value.lastIndexOf('|');
        if (split <= 0) return null;
        try {
            String name = new String(Base64.getUrlDecoder().decode(value.substring(0, split)), StandardCharsets.UTF_8);
            return new Viewer(id, name, "1".equals(value.substring(split + 1)));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static void sort(List<Viewer> viewers) {
        viewers.sort((left, right) -> left.name().compareTo(right.name()));
    }

    private Entry entry(Long roomId, String viewerId) {
        Map<String, Entry> room = rooms.get(roomId);
        return room == null ? null : room.get(viewerId);
    }

    private static void requireIdentity(Long roomId, String viewerId) {
        if (roomId == null) throw new IllegalArgumentException("roomId 不能为空");
        if (viewerId == null || viewerId.isBlank()) throw new IllegalArgumentException("viewerId 不能为空");
    }
}
