package com.salary.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class UserRequest {
    @NotBlank(message = "用户名不能为空")
    private String username;
    private String password;
    private String displayName;
    @NotBlank(message = "角色不能为空")
    private String role;
    private Integer enabled;
    private String dataScope;
    private String scopeGrades;
    private List<UserPermReq> permissionOverrides;
}
