package com.salary.community.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.time.LocalDateTime;

@Data
@TableName("TK_ARTICLE_COMMENT")
public class ArticleComment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long articleId;
    private String authorType;
    private String authorName;
    @JsonIgnore
    private String username;
    private String content;
    private String status;
    @JsonIgnore
    private String sourceHash;
    private LocalDateTime createdAt;
    @JsonIgnore
    private LocalDateTime reviewedAt;
    @JsonIgnore
    private String reviewedBy;
}
