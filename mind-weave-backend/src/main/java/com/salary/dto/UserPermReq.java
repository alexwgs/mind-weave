package com.salary.dto;

import lombok.Data;

@Data
public class UserPermReq {
    private String code;
    private String type; // ALLOW / DENY
}
