package com.salary.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("SLR_PERMISSION")
public class Permission {
    @TableId
    private String code;
    private String name;
    private String pgroup;
}
