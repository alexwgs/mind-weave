package com.salary.toolkit.dto;

import lombok.Data;

@Data
public class ShareReq {
    private Integer days = 7;
    private String password;
}
