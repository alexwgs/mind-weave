package com.salary.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("SLR_SALARY_RECORD")
public class SalaryRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private LocalDate month;
    private String grade;
    private BigDecimal postSalary;
    private BigDecimal regionAllowance;
    private BigDecimal bonus;
    private BigDecimal otherIncome;
    private BigDecimal postSubsidy;
    private BigDecimal overtimePay;
    private BigDecimal housingSubsidy;
    private BigDecimal workAllowance;
    private BigDecimal otherAdjust;
    private BigDecimal totalIncome;
    private BigDecimal pensionPersonal;
    private BigDecimal unemploymentPersonal;
    private BigDecimal medicalPersonal;
    private BigDecimal housingFundPersonal;
    private BigDecimal annuityPersonal;
    private BigDecimal incomeTax;
    private BigDecimal totalDeduction;
    private BigDecimal netPay;
    private BigDecimal totalSalary;
    private BigDecimal pensionCompany;
    private BigDecimal unemploymentCompany;
    private BigDecimal medicalCompany;
    private BigDecimal injuryCompany;
    private BigDecimal maternityCompany;
    private BigDecimal housingFundCompany;
    private BigDecimal annuityCompany;
    private BigDecimal companyTotal;
    private BigDecimal otherBonus;
    private BigDecimal annualBonus;
    private BigDecimal annualBonusTax;
    private BigDecimal annualBonusNet;
    private String formulaJson;
    private Long sourceBatchId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @TableField(exist = false)
    private Integer commentCount;
    @TableField(exist = false)
    private java.util.List<SalaryComment> comments;
}
