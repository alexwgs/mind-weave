package com.salary.toolkit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import org.apache.ibatis.type.JdbcType;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("TK_TODO")
public class Todo {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String owner;
    private String title;
    // 这些字段用 ALWAYS 策略，清空时会把 NULL 写进库；Oracle 不接受未标注类型的 null 绑定，
    // 所以必须显式给出 jdbcType，否则保存待办会直接 500。
    @TableField(updateStrategy = FieldStrategy.ALWAYS, jdbcType = JdbcType.VARCHAR)
    private String project;
    private String priority;
    @TableField(updateStrategy = FieldStrategy.ALWAYS, jdbcType = JdbcType.TIMESTAMP)
    private LocalDateTime dueTime;
    @TableField(updateStrategy = FieldStrategy.ALWAYS, jdbcType = JdbcType.TIMESTAMP)
    private LocalDateTime remindTime;
    @TableField(updateStrategy = FieldStrategy.ALWAYS, jdbcType = JdbcType.VARCHAR)
    private String remindNote;
    private Integer done;
    private Integer remindSent;
    private Integer overdueSent;
    @TableField(updateStrategy = FieldStrategy.ALWAYS, jdbcType = JdbcType.VARCHAR)
    private String recurRule;
    private Long recurParentId;
    @TableField(updateStrategy = FieldStrategy.ALWAYS, jdbcType = JdbcType.TIMESTAMP)
    private LocalDateTime recurLastFired;
    private LocalDateTime lastRemindTime;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @TableField(exist = false)
    private List<TodoSub> subs;
}
