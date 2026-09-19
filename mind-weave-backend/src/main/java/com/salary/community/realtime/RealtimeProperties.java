package com.salary.community.realtime;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "community.realtime")
public class RealtimeProperties {
    /** 是否启用实时推送；关闭后前端退回轮询 */
    private boolean enabled = true;

    /** 在线列表：超过该秒数没有心跳则视为离线。设短一点让"关掉页面"更快消失，但不能短到正常抖动就掉线 */
    private int viewerTimeoutSeconds = 45;

    /** 在线状态淘汰任务的执行间隔（秒）。越密，异常断线的成员越早从列表消失 */
    private int pruneIntervalSeconds = 10;

    /** SSE 保活心跳间隔（秒）。必须小于反向代理的读超时，否则连接会被网关掐断 */
    private int heartbeatSeconds = 15;

    /** SSE 连接最长存活秒数；到点后由浏览器 EventSource 自动重连，可回收服务端资源 */
    private int streamTimeoutSeconds = 1800;

    /** 输入中提示的持续毫秒数（前端据此淡出） */
    private long typingTtlMillis = 4000;

    /** 在线状态存储：memory 适合本地单实例；redis 适合容器部署和未来多实例。 */
    private String presenceStore = "memory";

    /** Redis key 前缀，便于与同一 Redis 中的其它应用隔离。 */
    private String redisKeyPrefix = "mindweave:community:presence";

    /** 预留：切换到 Kafka 广播实现时的 topic（当前内存实现不使用） */
    private String kafkaTopic = "mindweave.community.room";
}
