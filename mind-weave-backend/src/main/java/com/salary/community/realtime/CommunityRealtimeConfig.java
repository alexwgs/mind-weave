package com.salary.community.realtime;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import jakarta.annotation.PostConstruct;

/**
 * 实时推送装配。
 *
 * <p>这里同时负责把"在线列表变化"回灌成一次广播：在线列表由 SSE 连接的
 * 建立/断开驱动，任何订阅方式（内存或 Kafka）都通过监听器统一触发刷新。
 *
 * <p>{@code @EnableScheduling} 放在这里而不是启动类上，是为了让这套调度
 * （心跳、在线状态淘汰）不影响其他模块；由本模块统一开启。
 */
@Slf4j
@Configuration
@EnableScheduling
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "community.realtime", name = "enabled", havingValue = "true", matchIfMissing = true)
public class CommunityRealtimeConfig implements RoomEventListener {

    private final RealtimeBroadcaster broadcaster;

    @PostConstruct
    void register() {
        broadcaster.addListener(this);
        log.info("会客厅实时推送已启用（内存 SSE 广播，预留 Kafka 实现切换点）");
    }

    @Override
    public void onRoomEvent(Long roomId, RoomEvent event) {
        // 在线列表就在帧里，任何一次进出都用最新列表刷新房间内所有人
        broadcaster.onViewersChanged(roomId);
    }
}
