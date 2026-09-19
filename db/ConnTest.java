import java.sql.*;

public class OracleConnTest {
    public static void main(String[] args) {
        String url = "jdbc:oracle:thin:@wei6130.top:1521/TRMUSR";
        String user = "trmusr";
        String pass = "trmusr";
        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            System.out.println("CONNECTED_OK");
            DatabaseMetaData md = conn.getMetaData();
            System.out.println("DB_PRODUCT: " + md.getDatabaseProductName() + " " + md.getDatabaseProductVersion());
            System.out.println("DRIVER: " + md.getDriverName() + " " + md.getDriverVersion());
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT USER, SYSDATE FROM DUAL")) {
                rs.next();
                System.out.println("CURRENT_USER: " + rs.getString(1));
                System.out.println("SERVER_TIME: " + rs.getString(2));
            }
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT table_name FROM user_tables WHERE UPPER(table_name) LIKE 'SLR%' OR UPPER(table_name) LIKE '%SALARY%' OR UPPER(table_name) LIKE '%GZ%' ORDER BY table_name")) {
                int n = 0;
                while (rs.next()) {
                    System.out.println("SALARY_TABLE: " + rs.getString(1));
                    n++;
                }
                System.out.println("SALARY_TABLE_COUNT: " + n);
            }
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT privilege FROM session_privs WHERE privilege IN ('CREATE TABLE','CREATE ANY TABLE','CREATE USER','CREATE SEQUENCE','CREATE TRIGGER','UNLIMITED TABLESPACE') ORDER BY privilege")) {
                while (rs.next()) {
                    System.out.println("PRIV: " + rs.getString(1));
                }
            }
        } catch (SQLException e) {
            System.out.println("CONNECT_FAILED");
            e.printStackTrace();
        }
    }
}
