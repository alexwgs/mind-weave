package com.salary.dto;

import com.salary.entity.SalaryRecord;
import lombok.Data;

import java.util.List;

@Data
public class ImportPreview {
    private List<SalaryRecord> records;
    private List<String> warnings;
}
