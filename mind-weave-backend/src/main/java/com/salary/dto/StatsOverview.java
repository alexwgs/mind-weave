package com.salary.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class StatsOverview {
    private int yearFrom;
    private int yearTo;
    private BigDecimal rangeNetPay;
    private BigDecimal rangeTotalSalary;
    private BigDecimal latestMonthNet;
    private BigDecimal latestMonthTotal;
    private String latestMonth;
    private long monthCount;
    private long commentCount;
}
