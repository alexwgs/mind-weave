package com.salary.community.realtime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Redis 在线状态实现的契约测试，不连接或写入真实 Redis。 */
class PresenceServiceRedisTest {

    private StringRedisTemplate redis;
    private HashOperations<String, Object, Object> hashes;
    private ZSetOperations<String, String> sortedSets;
    private SetOperations<String, String> sets;
    private PresenceService presence;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        RealtimeProperties properties = new RealtimeProperties();
        properties.setPresenceStore("redis");
        properties.setRedisKeyPrefix("test:mindweave:presence");

        redis = mock(StringRedisTemplate.class);
        hashes = mock(HashOperations.class);
        sortedSets = mock(ZSetOperations.class);
        sets = mock(SetOperations.class);
        when(redis.opsForHash()).thenReturn(hashes);
        when(redis.opsForZSet()).thenReturn(sortedSets);
        when(redis.opsForSet()).thenReturn(sets);

        ObjectProvider<StringRedisTemplate> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(redis);
        presence = new PresenceService(properties, provider);
    }

    @Test
    void joinStoresIdentityAndHeartbeatInRedis() {
        Viewer viewer = presence.join(7L, "member-1", "魏根生", false);

        assertEquals("魏根生", viewer.name());
        assertFalse(viewer.guest());
        verify(hashes).put(anyString(), anyString(), anyString());
        verify(sortedSets).add(anyString(), anyString(), anyDouble());
        verify(sets).add("test:mindweave:presence:rooms", "7");
        verify(redis, times(2)).expire(anyString(), any());
    }

    @Test
    void touchRefreshesOnlyAnExistingViewer() {
        when(hashes.hasKey("test:mindweave:presence:room:7:viewers", "member-1")).thenReturn(true);

        presence.touch(7L, "member-1");

        verify(sortedSets).add(anyString(), anyString(), anyDouble());
        verify(redis, times(2)).expire(anyString(), any());
    }

    @Test
    void viewerRestoresMemberIdentityRegisteredByAuthenticatedHttpCall() {
        String encodedName = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("魏根生".getBytes(StandardCharsets.UTF_8));
        when(sortedSets.rangeByScore(anyString(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptySet());
        when(sortedSets.zCard(anyString())).thenReturn(1L);
        when(hashes.get("test:mindweave:presence:room:7:viewers", "member-1"))
                .thenReturn(encodedName + "|0");

        Viewer viewer = presence.viewer(7L, "member-1").orElseThrow();

        assertEquals("魏根生", viewer.name());
        assertFalse(viewer.guest());
        assertTrue(presence.redisBacked());
    }
}
