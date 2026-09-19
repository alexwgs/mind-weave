import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.FileInputStream;
import java.math.BigDecimal;
import java.sql.*;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * 将 工资明细表.xlsx 的"工资" sheet 导入 Oracle (SLR_* 表)。
 * 用法: java --class-path "<jars>" ImportExcel.java <xlsx路径>
 */
public class ImportExcel {

    private static final String URL = "jdbc:oracle:thin:@wei6130.top:1521/TRMUSR";
    private static final String USER = "trmusr";
    private static final String PASS = "trmusr";

    // 列字母 -> 数据库字段（B 列月份特殊处理）
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

    public static void main(String[] args) throws Exception {
        String xlsx = args.length > 0 ? args[0] : "工资明细表.xlsx";
        boolean replace = args.length > 1 && "replace".equalsIgnoreCase(args[1]);

        // 1) 值（公式缓存结果）
        Workbook wbVal;
        // 2) 公式 + 批注
        Workbook wbRaw;
        try (FileInputStream fin = new FileInputStream(xlsx)) {
            wbVal = WorkbookFactory.create(fin);
        }
        try (FileInputStream fin = new FileInputStream(xlsx)) {
            wbRaw = WorkbookFactory.create(fin);
        }
        Sheet valSheet = wbVal.getSheetAt(0);
        Sheet rawSheet = wbRaw.getSheetAt(0);

        // 表头校验（避免中文硬编码）
        Row header = rawSheet.getRow(0);
        if (header == null || getStr(header.getCell(1)) == null || getStr(header.getCell(1)).isEmpty()) {
            System.out.println("HEADER_CHECK_FAIL: B1 表头为空");
            return;
        }

        List<Record> records = new ArrayList<>();
        int maxRow = Math.min(valSheet.getLastRowNum(), rawSheet.getLastRowNum());
        for (int r = 1; r <= maxRow; r++) { // 0-based：第2行起
            Row vRow = valSheet.getRow(r);
            Row fRow = rawSheet.getRow(r);
            if (vRow == null || fRow == null) continue;
            java.util.Date month = getDate(fRow.getCell(1));
            if (month == null) continue; // 跳过无月份的行（如试算区第48行）

            Record rec = new Record();
            rec.rowNum = r + 1;
            rec.month = month;
            rec.grade = getStr(fRow.getCell(0));
            for (Map.Entry<String, String> e : COLMAP.entrySet()) {
                int colIdx = CellReference.convertColStringToIndex(e.getKey());
                Cell vc = vRow.getCell(colIdx);
                Cell fc = fRow.getCell(colIdx);
                rec.values.put(e.getValue(), getNum(vc));
                if (fc != null && fc.getCellType() == CellType.FORMULA) {
                    rec.formulas.put(e.getKey(), fc.getCellFormula());
                }
            }
            // 批注
            for (int c = 0; c <= fRow.getLastCellNum(); c++) {
                Cell fc = fRow.getCell(c);
                if (fc != null && fc.getCellComment() != null) {
                    Comment cm = fc.getCellComment();
                    String field = CellReference.convertNumToColString(c);
                    rec.comments.add(new CommentInfo(field, cm.getAuthor(), cm.getString().getString()));
                }
            }
            records.add(rec);
        }
        System.out.println("PARSED records=" + records.size()
                + " comments=" + records.stream().mapToInt(r -> r.comments.size()).sum()
                + " formulas=" + records.stream().mapToInt(r -> r.formulas.size()).sum());

        importToDb(records, new java.io.File(xlsx).getName(), replace);
        wbVal.close();
        wbRaw.close();
    }

    private static void importToDb(List<Record> records, String fileName, boolean replace) throws Exception {
        try (Connection conn = DriverManager.getConnection(URL, USER, PASS)) {
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM SLR_SALARY_RECORD")) {
                rs.next();
                if (rs.getInt(1) > 0) {
                    if (!replace) {
                        System.out.println("ABORT: SLR_SALARY_RECORD 已有数据，不重复导入（加 replace 参数可清空重导）。");
                        return;
                    }
                    try (Statement d = conn.createStatement()) {
                        d.execute("DELETE FROM SLR_SALARY_COMMENT");
                        d.execute("DELETE FROM SLR_SALARY_RECORD");
                        d.execute("DELETE FROM SLR_IMPORT_BATCH");
                    }
                    System.out.println("REPLACE: 已清空 SLR_ 数据表");
                }
            }
            conn.setAutoCommit(false);

            // 导入批次
            long batchId;
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO SLR_IMPORT_BATCH (FILE_NAME, IMPORT_BY, TOTAL_ROWS, OK_ROWS, WARN_MSG) VALUES (?,?,?,?,?)",
                    new String[]{"ID"})) {
                ps.setString(1, fileName);
                ps.setString(2, USER);
                ps.setInt(3, records.size());
                ps.setInt(4, records.size());
                ps.setString(5, "手工导入");
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    keys.next();
                    batchId = keys.getLong(1);
                }
            }

            String cols = String.join(",", COLMAP.values());
            String marks = String.join(",", Collections.nCopies(COLMAP.size(), "?"));
            String sql = "INSERT INTO SLR_SALARY_RECORD (MONTH, GRADE, " + cols
                    + ", FORMULA_JSON, SOURCE_BATCH_ID, CREATED_AT, UPDATED_AT) VALUES (?,?,"
                    + marks + ",?,?,SYSTIMESTAMP,SYSTIMESTAMP)";

            int ok = 0, cok = 0;
            for (Record rec : records) {
                try (PreparedStatement ps = conn.prepareStatement(sql, new String[]{"ID"})) {
                    int i = 1;
                    ps.setDate(i++, new java.sql.Date(rec.month.getTime()));
                    ps.setString(i++, rec.grade);
                    for (String f : COLMAP.values()) {
                        BigDecimal v = rec.values.get(f);
                        ps.setBigDecimal(i++, v);
                    }
                    ps.setString(i++, formulaJson(rec.formulas));
                    ps.setLong(i, batchId);
                    ps.executeUpdate();

                    long recordId;
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        keys.next();
                        recordId = keys.getLong(1);
                    }
                    for (CommentInfo cm : rec.comments) {
                        try (PreparedStatement cp = conn.prepareStatement(
                                "INSERT INTO SLR_SALARY_COMMENT (RECORD_ID, FIELD_CODE, AUTHOR, CONTENT, CREATED_AT, UPDATED_AT) VALUES (?,?,?,?,SYSTIMESTAMP,SYSTIMESTAMP)")) {
                            cp.setLong(1, recordId);
                            cp.setString(2, cm.field);
                            cp.setString(3, cm.author);
                            cp.setString(4, cm.content);
                            cp.executeUpdate();
                            cok++;
                        }
                    }
                    ok++;
                }
            }
            conn.commit();
            System.out.println("IMPORT_OK records=" + ok + " comments=" + cok + " batchId=" + batchId);
        }
    }

    private static String formulaJson(Map<String, String> formulas) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> e : formulas.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(e.getKey()).append("\":\"")
              .append(e.getValue().replace("\\", "\\\\").replace("\"", "\\\"")).append("\"");
        }
        sb.append("}");
        return sb.toString();
    }

    private static String getStr(Cell c) {
        if (c == null) return null;
        switch (c.getCellType()) {
            case STRING: return c.getStringCellValue().trim();
            case NUMERIC: return String.valueOf(c.getNumericCellValue());
            default: return null;
        }
    }

    private static java.util.Date getDate(Cell c) {
        if (c == null) return null;
        if (c.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(c)) {
            return c.getDateCellValue();
        }
        return null;
    }

    private static BigDecimal getNum(Cell c) {
        if (c == null) return null;
        if (c.getCellType() == CellType.NUMERIC) {
            if (DateUtil.isCellDateFormatted(c)) return null;
            return BigDecimal.valueOf(c.getNumericCellValue()).setScale(2, java.math.RoundingMode.HALF_UP);
        }
        if (c.getCellType() == CellType.FORMULA) {
            try {
                if (c.getCachedFormulaResultType() == CellType.NUMERIC) {
                    return BigDecimal.valueOf(c.getNumericCellValue()).setScale(2, java.math.RoundingMode.HALF_UP);
                }
                if (c.getCachedFormulaResultType() == CellType.STRING) {
                    return new BigDecimal(c.getStringCellValue().trim());
                }
            } catch (Exception e) {
                return null;
            }
        }
        if (c.getCellType() == CellType.STRING) {
            try {
                return new BigDecimal(c.getStringCellValue().trim());
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    private static final SimpleDateFormat SDF = new SimpleDateFormat("yyyy-MM-dd");

    static class Record {
        int rowNum;
        java.util.Date month;
        String grade;
        Map<String, BigDecimal> values = new LinkedHashMap<>();
        Map<String, String> formulas = new LinkedHashMap<>();
        List<CommentInfo> comments = new ArrayList<>();
    }

    static class CommentInfo {
        String field, author, content;
        CommentInfo(String field, String author, String content) {
            this.field = field;
            this.author = author;
            this.content = content;
        }
    }
}
