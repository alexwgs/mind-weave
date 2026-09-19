package com.salary.toolkit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("TK_TODO_SUB")
public class TodoSub {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long todoId;
    private String title;
    private Integer done;
    private Integer sortOrder;
}
