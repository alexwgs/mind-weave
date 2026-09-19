package com.salary.toolkit.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class RevealVO {
    private String account;
    private String password;
    private List<VaultFieldReq> fields;
}
