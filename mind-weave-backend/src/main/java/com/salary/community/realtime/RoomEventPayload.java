package com.salary.community.realtime;

import java.util.List;

/** 发给单个 SSE 连接的一帧载荷：当前在线列表 + 本次事件（心跳帧事件为 null） */
public record RoomEventPayload(List<Viewer> viewers, RoomEvent event) {
}
