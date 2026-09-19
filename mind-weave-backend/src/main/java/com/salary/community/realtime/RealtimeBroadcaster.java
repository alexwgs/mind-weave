package com.salary.community.realtime;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 会客厅实时广播抽象。
 *
 * <p>当前默认实现是 {@link InMemorySseBroadcaster}：单实例内存扇出 + SSE 推送。
 * 之所以把它抽成接口，是为了在不改业务代码的前提下接入 Kafka：
 * 实现一个 Kafka 版（发到 topic、再消费回本实例的连接表）即可，
 * 通过配置 {@code community.realtime.enabled} 与实现类上的
 * {@code @ConditionalOnProperty} 切换。接入前请先加 spring-kafka 依赖。
 *
 * <p>注意：消息本身始终同步写入 Oracle 后才广播，Kafka 只作为附加扇出通道，
 * 不承担持久化职责，避免出现"推送成功但没落库"的丢消息问题。
 */
public interface RealtimeBroadcaster {

    /** 为某个在线成员建立 SSE 订阅 */
    SseEmitter subscribe(Long roomId, Viewer viewer);

    /** 向房间内所有连接广播一帧事件 */
    void broadcast(Long roomId, RoomEvent event);

    /** 保活心跳：维持连接并顺带刷新在线列表 */
    void heartbeat(Long roomId);

    /** 关闭房间内全部连接（房间被关闭时使用） */
    void complete(Long roomId);

    /** 注册房间事件监听器 */
    void addListener(RoomEventListener listener);

    /** 主动通知在线列表发生了变化 */
    void onViewersChanged(Long roomId);
}
