package com.salary.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class MonthlyPoint {
    private String month;
    private BigDecimal netPay;
    private BigDecimal totalSalary;
}
