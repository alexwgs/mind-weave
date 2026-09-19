package com.salary.toolkit.dto;

import lombok.Data;

import java.util.List;

@Data
public class VaultItemReq {
    private Long groupId;
    private String name;
    private String account;
    private String password;
    private String note;
    private List<VaultFieldReq> fields;
}
