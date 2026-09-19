package com.salary.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class AnnualStat {
    private String year;
    private int monthCount;
    private BigDecimal totalIncome;
    private BigDecimal totalDeduction;
    private BigDecimal netPay;
    private BigDecimal companyTotal;
    private BigDecimal otherBonus;
    private BigDecimal annualBonus;
    private BigDecimal totalSalary;
    private Double netGrowth;
    private Double totalSalaryGrowth;
}
