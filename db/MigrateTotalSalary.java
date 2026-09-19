import java.sql.*;

/**
 * 迁移：为 SLR_SALARY_RECORD 增加 TOTAL_SALARY 列并回填存量数据。
 * 用法: java --class-path <ojdbc.jar> MigrateTotalSalary.java
 */
public class MigrateTotalSalary {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:oracle:thin:@wei6130.top:1521/TRMUSR";
        try (Connection conn = DriverManager.getConnection(url, "trmusr", "trmusr")) {
            boolean exists;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='SLR_SALARY_RECORD' AND COLUMN_NAME='TOTAL_SALARY'")) {
                rs.next();
                exists = rs.getInt(1) > 0;
            }
            if (!exists) {
                try (Statement st = conn.createStatement()) {
                    st.execute("ALTER TABLE SLR_SALARY_RECORD ADD TOTAL_SALARY NUMBER(12,2)");
                    st.execute("COMMENT ON COLUMN SLR_SALARY_RECORD.TOTAL_SALARY IS '总薪资=实发金额+其他奖金+年度奖金实发'");
                }
                System.out.println("COLUMN_ADDED");
            } else {
                System.out.println("COLUMN_EXISTS");
            }
            try (Statement st = conn.createStatement()) {
                int n = st.executeUpdate(
                    "UPDATE SLR_SALARY_RECORD SET TOTAL_SALARY = "
                    + "ROUND(NVL(NET_PAY,0) + NVL(OTHER_BONUS,0) + NVL(ANNUAL_BONUS_NET,0), 2)");
                System.out.println("BACKFILLED_ROWS=" + n);
            }
        }
    }
}
