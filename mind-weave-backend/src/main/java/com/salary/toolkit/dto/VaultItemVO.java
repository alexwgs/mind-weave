package com.salary.toolkit.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class VaultItemVO {
    private Long id;
    private Long groupId;
    private String name;
    private String accountMasked;
    private String passwordMasked;
    private String note;
    private List<VaultFieldReq> fields;
    private LocalDateTime lastViewAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private long attachmentCount;
}
