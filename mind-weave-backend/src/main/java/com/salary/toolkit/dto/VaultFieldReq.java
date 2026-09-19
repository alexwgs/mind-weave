package com.salary.toolkit.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class VaultFieldReq {
    public VaultFieldReq() {
    }

    private String key;
    private String value;
}
