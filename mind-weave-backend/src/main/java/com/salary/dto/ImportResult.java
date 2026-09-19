package com.salary.dto;

import lombok.Data;

import java.util.List;

@Data
public class ImportResult {
    private int recordCount;
    private int commentCount;
    private Long batchId;
    private List<String> warnings;
    private List<String> errors;
}
