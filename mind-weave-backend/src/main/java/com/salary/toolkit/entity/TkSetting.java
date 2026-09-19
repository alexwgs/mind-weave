package com.salary.toolkit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("TK_SETTING")
public class TkSetting {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String owner;
    private String setKey;
    private String setValue;
    private LocalDateTime updatedAt;
}
