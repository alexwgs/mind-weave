package com.salary.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("SLR_APP_USER")
public class AppUser {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String passwordHash;
    private String displayName;
    private String role;
    private Integer enabled;
    private LocalDateTime createdAt;
    private String dataScope;
    private String scopeGrades;
    private String openid;
}
