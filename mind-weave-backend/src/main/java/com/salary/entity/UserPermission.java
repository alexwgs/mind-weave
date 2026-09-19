package com.salary.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("SLR_USER_PERMISSION")
public class UserPermission {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String permCode;
    private String permType;
}
