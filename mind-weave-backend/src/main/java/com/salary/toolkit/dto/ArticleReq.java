package com.salary.toolkit.dto;

import lombok.Data;

@Data
public class ArticleReq {
    private String title;
    private String summary;
    private Long categoryId;
    private String tags;
    private String status;
    private String contentMd;
    private String contentHtml;
    private Long coverAttachId;
    private Integer isTop;
    private Integer isFeatured;
    private Integer isCarousel;
    private Integer commentEnabled;
}
