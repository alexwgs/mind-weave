import java.sql.*;

public class VerifyImport {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:oracle:thin:@wei6130.top:1521/TRMUSR";
        try (Connection conn = DriverManager.getConnection(url, "trmusr", "trmusr")) {
            q(conn, "SELECT COUNT(*) total, MIN(TO_CHAR(MONTH,'YYYY-MM')) min_m, MAX(TO_CHAR(MONTH,'YYYY-MM')) max_m FROM SLR_SALARY_RECORD");
            q(conn, "SELECT TO_CHAR(MONTH,'YYYY') yr, COUNT(*) cnt, SUM(NET_PAY) net_sum, SUM(TOTAL_INCOME) inc_sum, SUM(TOTAL_DEDUCTION) ded_sum FROM SLR_SALARY_RECORD GROUP BY TO_CHAR(MONTH,'YYYY') ORDER BY 1");
            q(conn, "SELECT COUNT(*) comment_cnt FROM SLR_SALARY_COMMENT");
            q(conn, "SELECT COUNT(*) formula_cnt FROM SLR_SALARY_RECORD WHERE FORMULA_JSON IS NOT NULL AND DBMS_LOB.GETLENGTH(FORMULA_JSON) > 2");
            q(conn, "SELECT r.ID, TO_CHAR(r.MONTH,'YYYY-MM') m, r.GRADE, r.NET_PAY, r.TOTAL_INCOME, r.TOTAL_DEDUCTION, r.OTHER_BONUS, r.ANNUAL_BONUS_NET, (SELECT COUNT(*) FROM SLR_SALARY_COMMENT c WHERE c.RECORD_ID=r.ID) cmt FROM SLR_SALARY_RECORD r WHERE TO_CHAR(r.MONTH,'YYYY-MM') IN ('2023-01','2025-01','2026-09') ORDER BY r.MONTH");
            q(conn, "SELECT TO_CHAR(MONTH,'YYYY-MM') m, GRADE, POST_SALARY, REGION_ALLOWANCE, BONUS, TOTAL_INCOME, PENSION_PERSONAL, NET_PAY FROM SLR_SALARY_RECORD WHERE ROWNUM <= 3 ORDER BY MONTH");
            q(conn, "SELECT TO_CHAR(r.MONTH,'YYYY-MM') m, c.FIELD_CODE, c.AUTHOR, SUBSTR(c.CONTENT,1,60) content FROM SLR_SALARY_COMMENT c JOIN SLR_SALARY_RECORD r ON r.ID=c.RECORD_ID WHERE c.FIELD_CODE IN ('AC','F','K') AND ROWNUM <= 12 ORDER BY r.MONTH");
            // 校验合计一致性：实发 = 加项 - 扣项
            q(conn, "SELECT COUNT(*) mismatch FROM SLR_SALARY_RECORD WHERE ABS(NET_PAY - (TOTAL_INCOME - TOTAL_DEDUCTION)) > 0.01");
            q(conn, "SELECT COUNT(*) null_month FROM SLR_SALARY_RECORD WHERE MONTH IS NULL");
            q(conn, "SELECT COUNT(*) dup_month FROM (SELECT MONTH FROM SLR_SALARY_RECORD GROUP BY MONTH HAVING COUNT(*)>1)");
        }
    }

    static void q(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData md = rs.getMetaData();
            int n = md.getColumnCount();
            System.out.println("-- " + sql.replaceAll("\\s+", " ").substring(0, Math.min(90, sql.length())) + (sql.length() > 90 ? "..." : ""));
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    if (i > 1) sb.append(" | ");
                    sb.append(md.getColumnLabel(i)).append("=").append(rs.getString(i));
                }
                System.out.println("   " + sb);
            }
        }
    }
}
