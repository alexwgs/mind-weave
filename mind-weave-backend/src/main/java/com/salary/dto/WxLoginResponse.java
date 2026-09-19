package com.salary.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class WxLoginResponse {
    private String token;
    private UserInfo user;
    private boolean needBind;
}
