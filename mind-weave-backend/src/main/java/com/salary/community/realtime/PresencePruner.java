package com.salary.community.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 定期淘汰心跳超时的在线条目。
 *
 * <p>拆成独立任务而不是跟着心跳走：心跳间隔受反向代理读超时约束（不能太长），
 * 淘汰则需要跑得更勤一些，这样异常断线的人（拔网线、进程被杀）能较快从
 * 在线列表消失。正常关闭页面会由前端上报 leave，不依赖这里。
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "community.realtime", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PresencePruner {

    private final PresenceService presence;
    private final RealtimeBroadcaster broadcaster;

    @Scheduled(fixedRateString = "${community.realtime.prune-interval-seconds:10}000")
    public void prune() {
        List<Long> activeRooms = presence.pruneStale();
        // 在线列表变了，让房间内的人立刻看到更新
        activeRooms.forEach(broadcaster::onViewersChanged);
    }
}
