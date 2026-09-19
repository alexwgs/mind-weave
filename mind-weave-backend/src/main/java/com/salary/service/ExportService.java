package com.salary.service;

import com.salary.dto.RecordQuery;
import com.salary.entity.SalaryComment;
import com.salary.entity.SalaryRecord;
import com.salary.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFClientAnchor;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFRichTextString;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class ExportService {
    private final SalaryService salaryService;
    private final LogService logService;
    private final PermissionService permissionService;

    private static final String MONEY_FMT = "#,##0.00;[Red]-#,##0.00";

    private record Col(String label, String group, String letter, Function<SalaryRecord, Object> getter) {
    }

    public byte[] exportRecords(RecordQuery q) {
        permissionService.require("records.export");
        List<SalaryRecord> list = salaryService.listAll(q);
        List<Col> cols = buildCols();
        Map<String, Integer> letterToCol = new HashMap<>();
        for (int i = 0; i < cols.size(); i++) {
            if (cols.get(i).letter() != null) {
                letterToCol.put(cols.get(i).letter(), i);
            }
        }
        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("工资明细");

            CellStyle titleStyle = style(wb, null, true, (short) 16);
            CellStyle subtitleStyle = style(wb, null, false, (short) 10);
            CellStyle headBase = headStyle(wb, 242, 242, 242);
            CellStyle headIncome = headStyle(wb, 221, 235, 247);
            CellStyle headDeduction = headStyle(wb, 253, 234, 218);
            CellStyle headPay = headStyle(wb, 255, 242, 204);
            CellStyle headCompany = headStyle(wb, 226, 239, 218);
            CellStyle headExtra = headStyle(wb, 228, 223, 236);
            CellStyle headComment = headStyle(wb, 242, 242, 242);

            CellStyle cellBase = cellStyle(wb, 255, 255, 255, false);
            CellStyle cellIncome = cellStyle(wb, 247, 251, 255, true);
            CellStyle cellDeduction = cellStyle(wb, 253, 246, 236, true);
            CellStyle cellPay = cellStyle(wb, 255, 253, 243, true);
            CellStyle cellCompany = cellStyle(wb, 236, 245, 255, true);
            CellStyle cellExtra = cellStyle(wb, 245, 241, 250, true);
            CellStyle cellComment = cellStyle(wb, 255, 251, 230, true);
            cellComment.setWrapText(true);
            cellComment.setAlignment(HorizontalAlignment.LEFT);
            cellComment.setVerticalAlignment(VerticalAlignment.TOP);

            int lastCol = cols.size() - 1;
            // 标题
            Row title = sheet.createRow(0);
            Cell tc = title.createCell(0);
            tc.setCellValue("工资明细表");
            tc.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, lastCol));
            title.setHeightInPoints(26);
            // 副标题
            Row sub = sheet.createRow(1);
            Cell sc = sub.createCell(0);
            sc.setCellValue("导出时间：" + LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                    + "    数据范围：" + describeRange(q));
            sc.setCellStyle(subtitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, lastCol));
            // 表头
            Row head = sheet.createRow(2);
            for (int i = 0; i < cols.size(); i++) {
                Cell c = head.createCell(i);
                c.setCellValue(cols.get(i).label());
                c.setCellStyle(headStyleFor(cols.get(i).group(),
                        headBase, headIncome, headDeduction, headPay, headCompany, headExtra, headComment));
            }
            head.setHeightInPoints(20);
            // 数据
            int r = 3;
            for (SalaryRecord rec : list) {
                Row row = sheet.createRow(r++);
                for (int i = 0; i < cols.size(); i++) {
                    Col col = cols.get(i);
                    Cell c = row.createCell(i);
                    Object v = col.getter().apply(rec);
                    c.setCellStyle(cellStyleFor(col.group(),
                            cellBase, cellIncome, cellDeduction, cellPay, cellCompany, cellExtra, cellComment));
                    if (v instanceof BigDecimal bd) {
                        if (bd != null) c.setCellValue(bd.doubleValue());
                    } else if (v != null) {
                        c.setCellValue(String.valueOf(v));
                    }
                }
                if (rec.getComments() != null && !rec.getComments().isEmpty()) {
                    int lines = rec.getComments().stream()
                            .mapToInt(cm -> cm.getFieldCode().length() + cm.getContent().length() / 40 + 1)
                            .sum();
                    row.setHeightInPoints(Math.max(20, Math.min(300, lines * 13f)));
                }
            }
            // 批注还原到对应单元格
            Drawing<?> drawing = sheet.createDrawingPatriarch();
            for (int i = 0; i < list.size(); i++) {
                SalaryRecord rec = list.get(i);
                if (rec.getComments() == null) continue;
                int rowIdx = 3 + i;
                for (SalaryComment c : rec.getComments()) {
                    Integer colIdx = letterToCol.get(c.getFieldCode());
                    if (colIdx == null) continue;
                    Comment cm = drawing.createCellComment(new XSSFClientAnchor(0, 0, 0, 0, colIdx, rowIdx, colIdx + 4, rowIdx + 5));
                    cm.setString(new XSSFRichTextString(nvl(c.getContent())));
                    cm.setAuthor(nvl(c.getAuthor()));
                    Row dataRow = sheet.getRow(rowIdx);
                    if (dataRow != null) {
                        Cell cell = dataRow.getCell(colIdx);
                        if (cell != null) cell.setCellComment(cm);
                    }
                }
            }
            if (r > 3) {
                sheet.setAutoFilter(new CellRangeAddress(2, r - 1, 0, lastCol));
            }
            sheet.createFreezePane(0, 3);
            setWidths(sheet, cols);

            // 批注汇总 sheet
            createCommentSheet(wb, list);

            wb.write(out);
            logService.record(SecurityUtils.currentUsername(), "EXPORT", "RECORD", null,
                    "导出工资明细 " + list.size() + " 条");
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("导出失败: " + e.getMessage(), e);
        }
    }

    private void createCommentSheet(XSSFWorkbook wb, List<SalaryRecord> list) {
        Sheet sheet = wb.createSheet("批注汇总");
        CellStyle head = headStyle(wb, 242, 242, 242);
        CellStyle cell = cellStyle(wb, 255, 255, 255, false);
        cell.setWrapText(true);
        cell.setAlignment(HorizontalAlignment.LEFT);
        cell.setVerticalAlignment(VerticalAlignment.TOP);

        String[] headers = {"月份", "字段", "作者", "批注内容"};
        Row hr = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell c = hr.createCell(i);
            c.setCellValue(headers[i]);
            c.setCellStyle(head);
        }
        int r = 1;
        for (SalaryRecord rec : list) {
            if (rec.getComments() == null) continue;
            for (SalaryComment cm : rec.getComments()) {
                Row row = sheet.createRow(r++);
                Cell m = row.createCell(0);
                m.setCellValue(rec.getMonth() == null ? "" : rec.getMonth().toString());
                m.setCellStyle(cell);
                Cell f = row.createCell(1);
                f.setCellValue(nvl(cm.getFieldCode()));
                f.setCellStyle(cell);
                Cell a = row.createCell(2);
                a.setCellValue(nvl(cm.getAuthor()));
                a.setCellStyle(cell);
                Cell ct = row.createCell(3);
                ct.setCellValue(nvl(cm.getContent()));
                ct.setCellStyle(cell);
                int lines = (cm.getContent() == null ? 0 : cm.getContent().split("\n", -1).length);
                row.setHeightInPoints(Math.max(20, Math.min(300, lines * 14f)));
            }
        }
        sheet.setColumnWidth(0, 14 * 256);
        sheet.setColumnWidth(1, 10 * 256);
        sheet.setColumnWidth(2, 12 * 256);
        sheet.setColumnWidth(3, 60 * 256);
        sheet.createFreezePane(0, 1);
    }

    private List<Col> buildCols() {
        List<Col> cols = new ArrayList<>();
        cols.add(new Col("月份", "base", null, r -> r.getMonth() == null ? "" : r.getMonth().toString()));
        cols.add(new Col("考核等级", "base", "A", SalaryRecord::getGrade));
        cols.add(new Col("岗位工资", "income", "C", SalaryRecord::getPostSalary));
        cols.add(new Col("地区补贴", "income", "D", SalaryRecord::getRegionAllowance));
        cols.add(new Col("奖金", "income", "E", SalaryRecord::getBonus));
        cols.add(new Col("其他", "income", "F", SalaryRecord::getOtherIncome));
        cols.add(new Col("岗位津贴", "income", "G", SalaryRecord::getPostSubsidy));
        cols.add(new Col("加班工资", "income", "H", SalaryRecord::getOvertimePay));
        cols.add(new Col("购房补贴", "income", "I", SalaryRecord::getHousingSubsidy));
        cols.add(new Col("工作补贴", "income", "J", SalaryRecord::getWorkAllowance));
        cols.add(new Col("其他/补差", "income", "K", SalaryRecord::getOtherAdjust));
        cols.add(new Col("加项合计", "income", "L", SalaryRecord::getTotalIncome));
        cols.add(new Col("养老保险(个人)", "deduction", "M", SalaryRecord::getPensionPersonal));
        cols.add(new Col("失业保险(个人)", "deduction", "N", SalaryRecord::getUnemploymentPersonal));
        cols.add(new Col("医疗保险(个人)", "deduction", "O", SalaryRecord::getMedicalPersonal));
        cols.add(new Col("住房公积金(个人)", "deduction", "P", SalaryRecord::getHousingFundPersonal));
        cols.add(new Col("企业年金(个人)", "deduction", "Q", SalaryRecord::getAnnuityPersonal));
        cols.add(new Col("个人所得税(个人)", "deduction", "R", SalaryRecord::getIncomeTax));
        cols.add(new Col("扣项合计", "deduction", "S", SalaryRecord::getTotalDeduction));
        cols.add(new Col("实发金额", "pay", "T", SalaryRecord::getNetPay));
        cols.add(new Col("总薪资", "pay", null, SalaryRecord::getTotalSalary));
        cols.add(new Col("养老保险(公司)", "company", "U", SalaryRecord::getPensionCompany));
        cols.add(new Col("失业保险(公司)", "company", "V", SalaryRecord::getUnemploymentCompany));
        cols.add(new Col("医疗保险(公司)", "company", "W", SalaryRecord::getMedicalCompany));
        cols.add(new Col("工伤保险(公司)", "company", "X", SalaryRecord::getInjuryCompany));
        cols.add(new Col("生育保险(公司)", "company", "Y", SalaryRecord::getMaternityCompany));
        cols.add(new Col("住房公积金(公司)", "company", "Z", SalaryRecord::getHousingFundCompany));
        cols.add(new Col("企业年金(公司)", "company", "AA", SalaryRecord::getAnnuityCompany));
        cols.add(new Col("公司合计", "company", "AB", SalaryRecord::getCompanyTotal));
        cols.add(new Col("其他奖金(单独发放)", "extra", "AC", SalaryRecord::getOtherBonus));
        cols.add(new Col("年度奖金", "extra", "AD", SalaryRecord::getAnnualBonus));
        cols.add(new Col("年度奖金个税", "extra", "AE", SalaryRecord::getAnnualBonusTax));
        cols.add(new Col("年度奖金实发", "extra", "AF", SalaryRecord::getAnnualBonusNet));
        return cols;
    }

    private static CellStyle style(XSSFWorkbook wb, XSSFColor bg, boolean bold, short fontSize) {
        XSSFCellStyle s = wb.createCellStyle();
        if (bg != null) {
            s.setFillForegroundColor(bg);
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }
        Font f = wb.createFont();
        f.setBold(bold);
        f.setFontHeightInPoints(fontSize);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        return s;
    }

    private static CellStyle headStyle(XSSFWorkbook wb, int r, int g, int b) {
        CellStyle s = style(wb, color(r, g, b), true, (short) 10);
        border(s);
        return s;
    }

    private static CellStyle cellStyle(XSSFWorkbook wb, int r, int g, int b, boolean money) {
        CellStyle s = style(wb, color(r, g, b), false, (short) 10);
        border(s);
        s.setAlignment(HorizontalAlignment.RIGHT);
        if (money) s.setDataFormat(wb.createDataFormat().getFormat(MONEY_FMT));
        return s;
    }

    private static void border(CellStyle s) {
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
        s.setTopBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        s.setBottomBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        s.setLeftBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        s.setRightBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
    }

    private static XSSFColor color(int r, int g, int b) {
        return new XSSFColor(new java.awt.Color(r, g, b));
    }

    private static CellStyle headStyleFor(String group,
                                          CellStyle base, CellStyle income, CellStyle deduction,
                                          CellStyle pay, CellStyle company, CellStyle extra, CellStyle comment) {
        return switch (group) {
            case "income" -> income;
            case "deduction" -> deduction;
            case "pay" -> pay;
            case "company" -> company;
            case "extra" -> extra;
            case "comment" -> comment;
            default -> base;
        };
    }

    private static CellStyle cellStyleFor(String group,
                                          CellStyle base, CellStyle income, CellStyle deduction,
                                          CellStyle pay, CellStyle company, CellStyle extra, CellStyle comment) {
        return switch (group) {
            case "income" -> income;
            case "deduction" -> deduction;
            case "pay" -> pay;
            case "company" -> company;
            case "extra" -> extra;
            case "comment" -> comment;
            default -> base;
        };
    }

    private static String describeRange(RecordQuery q) {
        List<String> parts = new ArrayList<>();
        if (q.getYear() != null) {
            parts.add(q.getYear() + " 年");
        } else {
            if (q.getMonthFrom() != null && !q.getMonthFrom().isBlank()) parts.add(q.getMonthFrom() + " 起");
            if (q.getMonthTo() != null && !q.getMonthTo().isBlank()) parts.add(q.getMonthTo() + " 止");
        }
        if (q.getGrade() != null && !q.getGrade().isBlank()) parts.add("考核 " + q.getGrade());
        if (q.getKeyword() != null && !q.getKeyword().isBlank()) parts.add("批注含「" + q.getKeyword() + "」");
        if (q.getHasComment() != null) parts.add(q.getHasComment() ? "有批注" : "无批注");
        if (q.getMinNetPay() != null || q.getMaxNetPay() != null) {
            parts.add("实发 " + (q.getMinNetPay() == null ? "" : q.getMinNetPay())
                    + "~" + (q.getMaxNetPay() == null ? "" : q.getMaxNetPay()));
        }
        return parts.isEmpty() ? "全部历史记录" : String.join("，", parts);
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }

    private void setWidths(Sheet sheet, List<Col> cols) {
        for (int i = 0; i < cols.size(); i++) {
            switch (cols.get(i).group()) {
                case "comment" -> sheet.setColumnWidth(i, 55 * 256);
                case "base" -> {
                    if (cols.get(i).label().equals("月份")) sheet.setColumnWidth(i, 12 * 256);
                    else sheet.setColumnWidth(i, 9 * 256);
                }
                default -> sheet.setColumnWidth(i, 13 * 256);
            }
        }
    }
}
