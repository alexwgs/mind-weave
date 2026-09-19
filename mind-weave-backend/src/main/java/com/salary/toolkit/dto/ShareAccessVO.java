package com.salary.toolkit.dto;

import com.salary.toolkit.entity.TkArticle;
import lombok.Data;

@Data
public class ShareAccessVO {
    private boolean needPassword;
    private TkArticle article;
}
