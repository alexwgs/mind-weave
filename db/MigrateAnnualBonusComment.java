import java.sql.*;

/**
 * 迁移：将 SLR_SALARY_RECORD.ANNUAL_BONUS(年度奖金) 金额转为
 * SLR_SALARY_COMMENT 中 FIELD_CODE='AF' 的批注"税前年终奖：<金额>"。
 * 用法: java --class-path <ojdbc.jar> MigrateAnnualBonusComment.java
 */
public class MigrateAnnualBonusComment {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:oracle:thin:@wei6130.top:1521/TRMUSR";
        try (Connection conn = DriverManager.getConnection(url, "trmusr", "trmusr");
             Statement st = conn.createStatement()) {
            int added = st.executeUpdate(
                "INSERT INTO SLR_SALARY_COMMENT (RECORD_ID, FIELD_CODE, AUTHOR, CONTENT, CREATED_AT, UPDATED_AT) "
                + "SELECT r.ID, 'AF', 'system', '税前年终奖：' || TO_CHAR(r.ANNUAL_BONUS), SYSTIMESTAMP, SYSTIMESTAMP "
                + "FROM SLR_SALARY_RECORD r "
                + "WHERE r.ANNUAL_BONUS IS NOT NULL AND r.ANNUAL_BONUS <> 0 "
                + "AND NOT EXISTS (SELECT 1 FROM SLR_SALARY_COMMENT c "
                + "  WHERE c.RECORD_ID = r.ID AND c.FIELD_CODE = 'AF' AND c.CONTENT LIKE '税前年终奖：%')");
            System.out.println("ADDED_COMMENTS=" + added);
            int removed = st.executeUpdate(
                "DELETE FROM SLR_SALARY_COMMENT WHERE FIELD_CODE = 'AF' AND CONTENT LIKE '税前年终奖：%' "
                + "AND NOT EXISTS (SELECT 1 FROM SLR_SALARY_RECORD r "
                + "  WHERE r.ID = RECORD_ID AND r.ANNUAL_BONUS IS NOT NULL AND r.ANNUAL_BONUS <> 0)");
            System.out.println("REMOVED_STALE=" + removed);
        }
    }
}
