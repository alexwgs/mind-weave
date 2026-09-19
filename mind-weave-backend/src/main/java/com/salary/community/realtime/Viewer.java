package com.salary.community.realtime;

/** 在线成员。游客按昵称展示，成员按账号展示名展示 */
public record Viewer(String id, String name, boolean guest) {
}
