package com.salary.toolkit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("TK_ATTACHMENT")
public class TkAttachment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String owner;
    private String bizType;
    private Long bizId;
    private String originalName;
    private String storedName;
    private String storagePath;
    private String mime;
    private Long sizeBytes;
    private Integer width;
    private Integer height;
    private LocalDateTime createdAt;
}
