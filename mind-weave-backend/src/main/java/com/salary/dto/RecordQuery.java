package com.salary.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class RecordQuery {
    private Integer page = 1;
    private Integer size = 12;
    private Integer year;
    private String monthFrom;
    private String monthTo;
    private String grade;
    private Boolean hasComment;
    private String keyword;
    private BigDecimal minNetPay;
    private BigDecimal maxNetPay;
    private String sortField;
    private String sortOrder;
}
