package com.salary.community.realtime;

/** 房间事件监听器（当前用于在线列表变更时唤醒 SSE 帧，Kafka 实现同样走这个接口） */
public interface RoomEventListener {
    void onRoomEvent(Long roomId, RoomEvent event);
}
