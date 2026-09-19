package com.salary.toolkit.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import org.apache.ibatis.type.JdbcType;

import java.time.LocalDateTime;

@Data
@TableName("TK_ARTICLE")
public class TkArticle {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String owner;
    private String title;
    private String summary;
    private Long categoryId;
    private String tags;
    private String status;
    private String contentMd;
    private String contentHtml;
    private Integer viewCount;
    private Long coverAttachId;
    private Integer isTop;
    private Integer isFeatured;
    private Integer isCarousel;
    /** 是否允许公开评论：1 允许，0 关闭。 */
    private Integer commentEnabled;
    // 这三个字段必须允许写 null：MyBatis-Plus 默认跳过 null 字段，
    // 否则"取消分享"只会返回成功，分享凭证依旧留在库里。
    // jdbcType 也必须写明，Oracle 驱动不接受未标注类型的 null 绑定。
    @TableField(updateStrategy = FieldStrategy.ALWAYS, jdbcType = JdbcType.VARCHAR)
    private String shareToken;
    @TableField(updateStrategy = FieldStrategy.ALWAYS, jdbcType = JdbcType.TIMESTAMP)
    private LocalDateTime shareExpire;
    @TableField(updateStrategy = FieldStrategy.ALWAYS, jdbcType = JdbcType.VARCHAR)
    private String sharePassword;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @TableField(exist = false)
    private String categoryPath;

    // ---- 公开接口返回的派生字段（不落库） ----

    /** 帖主是否已开启分享；未开启时公开接口只返回预览 */
    @TableField(exist = false)
    private Boolean shared;

    /** 未开启分享时的正文预览（已截断） */
    @TableField(exist = false)
    private String previewHtml;

    /** 未开启分享的原因，由后端给出，前端直接展示 */
    @TableField(exist = false)
    private String lockReason;

    /** 预估阅读时长（分钟） */
    @TableField(exist = false)
    private Integer readingMinutes;
}
