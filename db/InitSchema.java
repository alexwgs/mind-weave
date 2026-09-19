import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * 读取 db/schema.sql 并逐条执行（幂等：已存在对象跳过）。
 * 用法: java --class-path <ojdbc.jar> InitSchema.java <schema.sql路径>
 */
public class InitSchema {
    public static void main(String[] args) throws IOException {
        String url = "jdbc:oracle:thin:@wei6130.top:1521/TRMUSR";
        String user = "trmusr";
        String pass = "trmusr";
        String sqlFile = args.length > 0 ? args[0] : "schema.sql";

        String sql = new String(Files.readAllBytes(Paths.get(sqlFile)), StandardCharsets.UTF_8);
        // 去掉行注释，按分号拆分语句
        StringBuilder clean = new StringBuilder();
        for (String line : sql.split("\\r?\\n")) {
            String t = line.trim();
            if (t.startsWith("--") || t.isEmpty()) continue;
            clean.append(line).append("\n");
        }
        String[] stmts = clean.toString().split(";");

        try (Connection conn = DriverManager.getConnection(url, user, pass);
             Statement st = conn.createStatement()) {
            int ok = 0, skip = 0, fail = 0;
            for (String s : stmts) {
                if (s == null || s.trim().isEmpty()) continue;
                try {
                    st.execute(s.trim());
                    ok++;
                    System.out.println("OK: " + s.trim().substring(0, Math.min(60, s.trim().length())) + "...");
                } catch (SQLException e) {
                    if (e.getErrorCode() == 955) { // ORA-00955: name already used
                        skip++;
                        System.out.println("SKIP(already exists): " + s.trim().substring(0, Math.min(60, s.trim().length())));
                    } else if (e.getErrorCode() == 2260 || e.getErrorCode() == 1442) {
                        // 对象已存在/重复定义
                        skip++;
                        System.out.println("SKIP: " + s.trim().substring(0, Math.min(60, s.trim().length())) + " (" + e.getErrorCode() + ")");
                    } else {
                        fail++;
                        System.out.println("FAIL: " + s.trim().substring(0, Math.min(80, s.trim().length())));
                        System.out.println("  -> " + e.getMessage());
                    }
                }
            }
            System.out.println("DONE ok=" + ok + " skip=" + skip + " fail=" + fail);
        } catch (SQLException e) {
            System.out.println("CONNECT_FAILED: " + e.getMessage());
        }
    }
}
