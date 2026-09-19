package com.salary.toolkit.dto;

import lombok.Data;

@Data
public class SettingVO {
    private String barkUrl;
    private String digestTime;
    private Boolean pinSet;
    private Boolean barkEnabled;
    private String siteName;
    private String announcement;
    private String footer;
}
