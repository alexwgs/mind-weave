package com.salary.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("SLR_ROLE_PERMISSION")
public class RolePermission {
    @TableId
    private String role;
    private String permCode;
}
