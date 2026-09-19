package com.salary.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("SLR_SALARY_COMMENT")
public class SalaryComment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long recordId;
    private String fieldCode;
    private String author;
    private String content;
    private String itemsJson;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
