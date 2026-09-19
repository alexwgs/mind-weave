package com.salary.community.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("TK_CHAT_ROOM")
public class ChatRoom {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String description;
    private Integer active;
    private Integer sortOrder;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
