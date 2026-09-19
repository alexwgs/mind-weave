package com.salary.toolkit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("TK_VAULT_ITEM")
public class VaultItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String owner;
    private Long groupId;
    private String name;
    private String account;
    private String password;
    private String note;
    private LocalDateTime lastViewAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @TableField(exist = false)
    private List<VaultField> fields;
}
