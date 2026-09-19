package com.salary.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class UserInfo {
    private Long id;
    private String username;
    private String displayName;
    private String role;
    private Integer enabled;
    private String dataScope;
    private String scopeGrades;
    private List<String> permissions;
    private List<String> allowOverrides;
    private List<String> denyCodes;
}
