package com.salary.toolkit.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("TK_ARTICLE_CATEGORY")
public class ArticleCategory {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String owner;
    private Long parentId;
    private String name;
    private String path;
    private Integer sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
