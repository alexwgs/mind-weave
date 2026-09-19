package com.salary.toolkit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("TK_VAULT_FIELD")
public class VaultField {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long itemId;
    private String fieldKey;
    private String fieldValue;
}
