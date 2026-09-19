package com.salary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.salary.common.BizException;
import com.salary.dto.ImportPreview;
import com.salary.dto.ImportResult;
import com.salary.entity.ImportBatch;
import com.salary.entity.SalaryComment;
import com.salary.entity.SalaryRecord;
import com.salary.mapper.ImportBatchMapper;
import com.salary.mapper.SalaryCommentMapper;
import com.salary.mapper.SalaryRecordMapper;
import com.salary.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportService {
    private final SalaryRecordMapper recordMapper;
    private final SalaryCommentMapper commentMapper;
    private final ImportBatchMapper batchMapper;
    private final LogService logService;
    private final AnnualBonusCommentService annualBonusCommentService;
    private final PermissionService permissionService;

    private static final Map<String, String> COLMAP = new LinkedHashMap<>();
    static {
        COLMAP.put("C",  "POST_SALARY");
        COLMAP.put("D",  "REGION_ALLOWANCE");
        COLMAP.put("E",  "BONUS");
        COLMAP.put("F",  "OTHER_INCOME");
        COLMAP.put("G",  "POST_SUBSIDY");
        COLMAP.put("H",  "OVERTIME_PAY");
        COLMAP.put("I",  "HOUSING_SUBSIDY");
        COLMAP.put("J",  "WORK_ALLOWANCE");
        COLMAP.put("K",  "OTHER_ADJUST");
        COLMAP.put("L",  "TOTAL_INCOME");
        COLMAP.put("M",  "PENSION_PERSONAL");
        COLMAP.put("N",  "UNEMPLOYMENT_PERSONAL");
        COLMAP.put("O",  "MEDICAL_PERSONAL");
        COLMAP.put("P",  "HOUSING_FUND_PERSONAL");
        COLMAP.put("Q",  "ANNUITY_PERSONAL");
        COLMAP.put("R",  "INCOME_TAX");
        COLMAP.put("S",  "TOTAL_DEDUCTION");
        COLMAP.put("T",  "NET_PAY");
        COLMAP.put("U",  "PENSION_COMPANY");
        COLMAP.put("V",  "UNEMPLOYMENT_COMPANY");
        COLMAP.put("W",  "MEDICAL_COMPANY");
        COLMAP.put("X",  "INJURY_COMPANY");
        COLMAP.put("Y",  "MATERNITY_COMPANY");
        COLMAP.put("Z",  "HOUSING_FUND_COMPANY");
        COLMAP.put("AA", "ANNUITY_COMPANY");
        COLMAP.put("AB", "COMPANY_TOTAL");
        COLMAP.put("AC", "OTHER_BONUS");
        COLMAP.put("AD", "ANNUAL_BONUS");
        COLMAP.put("AE", "ANNUAL_BONUS_TAX");
        COLMAP.put("AF", "ANNUAL_BONUS_NET");
    }

    private static final List<String> VALUE_COLUMNS = List.copyOf(COLMAP.values());

    public ImportPreview preview(MultipartFile file) {
        permissionService.require("import.execute");
        List<SalaryRecord> records = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            parseSheet(wb, records, warnings);
        } catch (IOException e) {
            throw new BizException("文件读取失败: " + e.getMessage());
        }
        ImportPreview p = new ImportPreview();
        p.setRecords(records);
        p.setWarnings(warnings);
        return p;
    }

    @Transactional
    public ImportResult execute(MultipartFile file, String mode) {
        permissionService.require("import.execute");
        List<SalaryRecord> records = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            parseSheet(wb, records, warnings);
        } catch (IOException e) {
            throw new BizException("文件读取失败: " + e.getMessage());
        }
        if (records.isEmpty()) {
            throw new BizException("文件中没有可导入的工资记录");
        }

        ImportResult result = new ImportResult();
        result.setWarnings(warnings);
        result.setErrors(new ArrayList<>());

        for (SalaryRecord r : records) {
            r.setTotalSalary(sumNullSafe(r.getNetPay(), r.getOtherBonus(), r.getAnnualBonusNet()));
        }

        if ("replace".equalsIgnoreCase(mode)) {
            commentMapper.delete(null);
            recordMapper.delete(null);
            batchMapper.delete(null);
        } else {
            List<LocalDate> existMonths = recordMapper.selectList(null).stream()
                    .map(SalaryRecord::getMonth).toList();
            Set<LocalDate> existSet = new HashSet<>(existMonths);
            for (SalaryRecord r : records) {
                if (existSet.contains(r.getMonth())) {
                    result.getErrors().add("月份 " + r.getMonth() + " 已存在，请选择'替换'模式或先删除该记录");
                }
            }
            if (!result.getErrors().isEmpty()) {
                return result;
            }
        }

        ImportBatch batch = new ImportBatch();
        batch.setFileName(file.getOriginalFilename());
        batch.setImportBy(SecurityUtils.currentUsername());
        batch.setImportTime(LocalDateTime.now());
        batch.setTotalRows(records.size());
        batch.setOkRows(records.size());
        batch.setWarnMsg(warnings.isEmpty() ? null : String.join("; ", warnings).substring(0, Math.min(1900, String.join("; ", warnings).length())));
        batchMapper.insert(batch);

        int commentCount = 0;
        for (SalaryRecord r : records) {
            r.setSourceBatchId(batch.getId());
            r.setCreatedAt(LocalDateTime.now());
            r.setUpdatedAt(LocalDateTime.now());
            recordMapper.insert(r);
            if (r.getComments() != null) {
                for (SalaryComment c : r.getComments()) {
                    c.setId(null);
                    c.setRecordId(r.getId());
                    c.setCreatedAt(LocalDateTime.now());
                    c.setUpdatedAt(LocalDateTime.now());
                    commentMapper.insert(c);
                    commentCount++;
                }
            }
            annualBonusCommentService.sync(r);
        }
        result.setRecordCount(records.size());
        result.setCommentCount(commentCount);
        result.setBatchId(batch.getId());
        logService.record(SecurityUtils.currentUsername(), "IMPORT", "BATCH", batch.getId(),
                "导入 " + records.size() + " 条记录, " + commentCount + " 条批注, 模式=" + mode);
        return result;
    }

    private void parseSheet(Workbook wb, List<SalaryRecord> records, List<String> warnings) {
        Sheet sheet = wb.getSheetAt(0);
        Row header = sheet.getRow(0);
        if (header == null || header.getCell(1) == null
                || header.getCell(1).getCellType() != CellType.STRING
                || header.getCell(1).getStringCellValue().trim().isEmpty()) {
            throw new BizException("表头校验失败：B1 应为'月份'");
        }
        Set<LocalDate> months = new HashSet<>();
        for (int r = 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            Cell monthCell = row.getCell(1);
            if (monthCell == null || monthCell.getCellType() != CellType.NUMERIC
                    || !DateUtil.isCellDateFormatted(monthCell)) {
                continue;
            }
            LocalDate month = monthCell.getDateCellValue().toInstant()
                    .atZone(ZoneId.systemDefault()).toLocalDate().withDayOfMonth(1);
            if (!months.add(month)) {
                warnings.add("文件内重复月份: " + month);
                continue;
            }
            SalaryRecord rec = new SalaryRecord();
            rec.setMonth(month);
            rec.setGrade(stringValue(row.getCell(0)));
            if (rec.getGrade() == null || rec.getGrade().isBlank()) {
                warnings.add(month + " 考核等级为空");
            }
            Map<String, String> formulas = new LinkedHashMap<>();
            for (Map.Entry<String, String> e : COLMAP.entrySet()) {
                int idx = CellReference.convertColStringToIndex(e.getKey());
                Cell c = row.getCell(idx);
                setField(rec, e.getValue(), numericValue(c));
                if (c != null && c.getCellType() == CellType.FORMULA) {
                    formulas.put(e.getKey(), c.getCellFormula());
                }
            }
            if (formulas.isEmpty()) {
                rec.setFormulaJson(null);
            } else {
                StringBuilder sb = new StringBuilder("{");
                boolean first = true;
                for (Map.Entry<String, String> fe : formulas.entrySet()) {
                    if (!first) sb.append(",");
                    first = false;
                    sb.append("\"").append(fe.getKey()).append("\":\"")
                      .append(fe.getValue().replace("\\", "\\\\").replace("\"", "\\\"")).append("\"");
                }
                sb.append("}");
                rec.setFormulaJson(sb.toString());
            }
            if (rec.getOtherIncome() != null && rec.getOtherIncome().signum() < 0) {
                warnings.add(month + " 其他(奖金)存在负值: " + rec.getOtherIncome());
            }
            if (rec.getBonus() != null && rec.getBonus().signum() < 0) {
                warnings.add(month + " 奖金存在负值: " + rec.getBonus());
            }

            List<SalaryComment> comments = new ArrayList<>();
            for (int c = 0; c <= row.getLastCellNum(); c++) {
                Cell cell = row.getCell(c);
                if (cell != null && cell.getCellComment() != null) {
                    Comment cm = cell.getCellComment();
                    SalaryComment sc = new SalaryComment();
                    sc.setFieldCode(CellReference.convertNumToColString(c));
                    sc.setAuthor(cm.getAuthor());
                    sc.setContent(cm.getString().getString());
                    comments.add(sc);
                }
            }
            rec.setComments(comments);
            records.add(rec);
        }
    }

    private static BigDecimal numericValue(Cell c) {
        if (c == null) return null;
        if (c.getCellType() == CellType.NUMERIC) {
            if (DateUtil.isCellDateFormatted(c)) return null;
            return BigDecimal.valueOf(c.getNumericCellValue()).setScale(2, RoundingMode.HALF_UP);
        }
        if (c.getCellType() == CellType.FORMULA) {
            try {
                if (c.getCachedFormulaResultType() == CellType.NUMERIC) {
                    return BigDecimal.valueOf(c.getNumericCellValue()).setScale(2, RoundingMode.HALF_UP);
                }
                if (c.getCachedFormulaResultType() == CellType.STRING) {
                    return new BigDecimal(c.getStringCellValue().trim());
                }
            } catch (RuntimeException e) {
                return null;
            }
        }
        if (c.getCellType() == CellType.STRING) {
            try {
                return new BigDecimal(c.getStringCellValue().trim());
            } catch (RuntimeException e) {
                return null;
            }
        }
        return null;
    }

    private static String stringValue(Cell c) {
        if (c == null) return null;
        if (c.getCellType() == CellType.STRING) return c.getStringCellValue().trim();
        if (c.getCellType() == CellType.NUMERIC) return String.valueOf(c.getNumericCellValue());
        if (c.getCellType() == CellType.FORMULA && c.getCachedFormulaResultType() == CellType.STRING) {
            return c.getStringCellValue().trim();
        }
        return null;
    }

    private static void setField(SalaryRecord r, String field, BigDecimal v) {
        switch (field) {
            case "POST_SALARY" -> r.setPostSalary(v);
            case "REGION_ALLOWANCE" -> r.setRegionAllowance(v);
            case "BONUS" -> r.setBonus(v);
            case "OTHER_INCOME" -> r.setOtherIncome(v);
            case "POST_SUBSIDY" -> r.setPostSubsidy(v);
            case "OVERTIME_PAY" -> r.setOvertimePay(v);
            case "HOUSING_SUBSIDY" -> r.setHousingSubsidy(v);
            case "WORK_ALLOWANCE" -> r.setWorkAllowance(v);
            case "OTHER_ADJUST" -> r.setOtherAdjust(v);
            case "TOTAL_INCOME" -> r.setTotalIncome(v);
            case "PENSION_PERSONAL" -> r.setPensionPersonal(v);
            case "UNEMPLOYMENT_PERSONAL" -> r.setUnemploymentPersonal(v);
            case "MEDICAL_PERSONAL" -> r.setMedicalPersonal(v);
            case "HOUSING_FUND_PERSONAL" -> r.setHousingFundPersonal(v);
            case "ANNUITY_PERSONAL" -> r.setAnnuityPersonal(v);
            case "INCOME_TAX" -> r.setIncomeTax(v);
            case "TOTAL_DEDUCTION" -> r.setTotalDeduction(v);
            case "NET_PAY" -> r.setNetPay(v);
            case "PENSION_COMPANY" -> r.setPensionCompany(v);
            case "UNEMPLOYMENT_COMPANY" -> r.setUnemploymentCompany(v);
            case "MEDICAL_COMPANY" -> r.setMedicalCompany(v);
            case "INJURY_COMPANY" -> r.setInjuryCompany(v);
            case "MATERNITY_COMPANY" -> r.setMaternityCompany(v);
            case "HOUSING_FUND_COMPANY" -> r.setHousingFundCompany(v);
            case "ANNUITY_COMPANY" -> r.setAnnuityCompany(v);
            case "COMPANY_TOTAL" -> r.setCompanyTotal(v);
            case "OTHER_BONUS" -> r.setOtherBonus(v);
            case "ANNUAL_BONUS" -> r.setAnnualBonus(v);
            case "ANNUAL_BONUS_TAX" -> r.setAnnualBonusTax(v);
            case "ANNUAL_BONUS_NET" -> r.setAnnualBonusNet(v);
            default -> { }
        }
    }

    private static BigDecimal sumNullSafe(BigDecimal... vals) {
        BigDecimal s = BigDecimal.ZERO;
        for (BigDecimal v : vals) {
            if (v != null) s = s.add(v);
        }
        return s.setScale(2, RoundingMode.HALF_UP);
    }
}
