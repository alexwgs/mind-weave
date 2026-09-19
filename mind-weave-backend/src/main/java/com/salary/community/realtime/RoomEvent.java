package com.salary.community.realtime;

import com.salary.community.entity.ChatMessage;

/**
 * 房间内实时事件。用普通 record + 可空字段承载多种语义，
 * 避免给集合类型的 SSE 载荷引入多态序列化，前端按 kind 分支处理。
 */
public record RoomEvent(String kind, ChatMessage message, String viewerId, String name, String action) {

    /** 新消息 */
    public static RoomEvent message(ChatMessage message) {
        return new RoomEvent("message", message, null, null, null);
    }

    /** 管理员删除消息，message 只需携带 id 供所有客户端同步移除 */
    public static RoomEvent deleted(ChatMessage message) {
        return new RoomEvent("deleted", message, null, null, null);
    }

    /** 有人开始输入 */
    public static RoomEvent typing(String viewerId, String name) {
        return new RoomEvent("typing", null, viewerId, name, null);
    }

    /** 有人进出房间 */
    public static RoomEvent presence(String viewerId, String name, boolean joined) {
        return new RoomEvent("presence", null, viewerId, name, joined ? "join" : "leave");
    }
}
