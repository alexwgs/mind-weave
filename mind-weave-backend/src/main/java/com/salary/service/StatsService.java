package com.salary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.salary.dto.AnnualStat;
import com.salary.dto.MonthlyPoint;
import com.salary.dto.StatsOverview;
import com.salary.entity.SalaryComment;
import com.salary.entity.SalaryRecord;
import com.salary.mapper.SalaryCommentMapper;
import com.salary.mapper.SalaryRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatsService {
    private final SalaryRecordMapper recordMapper;
    private final SalaryCommentMapper commentMapper;
    private final PermissionService permissionService;

    public StatsOverview overview(Integer yearFrom, Integer yearTo) {
        permissionService.require("stats");
        int from = yearFrom == null ? 2023 : yearFrom;
        int to = yearTo == null ? LocalDate.now().getYear() : yearTo;
        StatsOverview o = new StatsOverview();
        o.setYearFrom(from);
        o.setYearTo(to);

        QueryWrapper<SalaryRecord> sumsQ = new QueryWrapper<SalaryRecord>()
                .select("SUM(NET_PAY) NET", "SUM(TOTAL_SALARY) TOT", "COUNT(*) CNT")
                .ge("MONTH", LocalDate.of(from, 1, 1))
                .le("MONTH", LocalDate.of(to, 12, 31));
        applyScope(sumsQ);
        List<Map<String, Object>> sums = recordMapper.selectMaps(sumsQ);
        if (!sums.isEmpty()) {
            o.setRangeNetPay(dec(sums.get(0), "NET"));
            o.setRangeTotalSalary(dec(sums.get(0), "TOT"));
            o.setMonthCount(dec(sums.get(0), "CNT") == null ? 0 : dec(sums.get(0), "CNT").longValue());
        }

        LambdaQueryWrapper<SalaryRecord> latestQ = new LambdaQueryWrapper<SalaryRecord>()
                .ge(SalaryRecord::getMonth, LocalDate.of(from, 1, 1))
                .le(SalaryRecord::getMonth, LocalDate.of(to, 12, 31))
                .orderByDesc(SalaryRecord::getMonth).last("FETCH FIRST 1 ROWS ONLY");
        applyScopeLambda(latestQ);
        SalaryRecord latest = recordMapper.selectOne(latestQ);
        if (latest != null) {
            o.setLatestMonth(latest.getMonth().toString());
            o.setLatestMonthNet(latest.getNetPay());
            o.setLatestMonthTotal(latest.getTotalSalary());
        }
        LocalDate fromDate = LocalDate.of(from, 1, 1);
        LocalDate toDate = LocalDate.of(to, 12, 31);
        Long commentCount = commentMapper.selectCount(new QueryWrapper<SalaryComment>()
                .exists("SELECT 1 FROM SLR_SALARY_RECORD r WHERE r.ID = SLR_SALARY_COMMENT.RECORD_ID "
                        + "AND r.MONTH >= {0} AND r.MONTH <= {1}" + gradeSqlClause(), fromDate, toDate));
        o.setCommentCount(commentCount == null ? 0 : commentCount);
        return o;
    }

    public List<AnnualStat> annual(Integer yearFrom, Integer yearTo) {
        permissionService.require("stats");
        int from = yearFrom == null ? 2023 : yearFrom;
        int to = yearTo == null ? LocalDate.now().getYear() : yearTo;
        QueryWrapper<SalaryRecord> annualQ = new QueryWrapper<SalaryRecord>()
                .select("TO_CHAR(MONTH, 'YYYY') YR",
                        "COUNT(*) CNT",
                        "SUM(TOTAL_INCOME) INC",
                        "SUM(TOTAL_DEDUCTION) DED",
                        "SUM(NET_PAY) NET",
                        "SUM(COMPANY_TOTAL) CO",
                        "SUM(OTHER_BONUS) OB",
                        "SUM(ANNUAL_BONUS) AB",
                        "SUM(TOTAL_SALARY) TOTS")
                .ge("MONTH", LocalDate.of(from, 1, 1))
                .le("MONTH", LocalDate.of(to, 12, 31))
                .groupBy("TO_CHAR(MONTH, 'YYYY')")
                .orderByAsc("TO_CHAR(MONTH, 'YYYY')");
        applyScope(annualQ);
        List<Map<String, Object>> rows = recordMapper.selectMaps(annualQ);
        List<AnnualStat> list = new ArrayList<>();
        BigDecimal prevNet = null;
        BigDecimal prevTotal = null;
        for (Map<String, Object> row : rows) {
            AnnualStat s = new AnnualStat();
            s.setYear(str(row, "YR"));
            s.setMonthCount(dec(row, "CNT").intValue());
            s.setTotalIncome(dec(row, "INC"));
            s.setTotalDeduction(dec(row, "DED"));
            s.setNetPay(dec(row, "NET"));
            s.setCompanyTotal(dec(row, "CO"));
            s.setOtherBonus(dec(row, "OB"));
            s.setAnnualBonus(dec(row, "AB"));
            s.setTotalSalary(dec(row, "TOTS"));
            if (prevNet != null && prevNet.compareTo(BigDecimal.ZERO) > 0 && s.getNetPay() != null) {
                s.setNetGrowth(s.getNetPay().subtract(prevNet)
                        .divide(prevNet, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                        .doubleValue());
            }
            if (prevTotal != null && prevTotal.compareTo(BigDecimal.ZERO) > 0 && s.getTotalSalary() != null) {
                s.setTotalSalaryGrowth(s.getTotalSalary().subtract(prevTotal)
                        .divide(prevTotal, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                        .doubleValue());
            }
            prevNet = s.getNetPay();
            prevTotal = s.getTotalSalary();
            list.add(s);
        }
        return list;
    }

    public List<MonthlyPoint> monthlyTrend(Integer yearFrom, Integer yearTo) {
        permissionService.require("stats");
        int from = yearFrom == null ? 2023 : yearFrom;
        int to = yearTo == null ? LocalDate.now().getYear() : yearTo;
        QueryWrapper<SalaryRecord> w = new QueryWrapper<SalaryRecord>()
                .select("TO_CHAR(MONTH, 'YYYY-MM') M", "SUM(NET_PAY) NET", "SUM(TOTAL_SALARY) TOT")
                .ge("MONTH", LocalDate.of(from, 1, 1))
                .le("MONTH", LocalDate.of(to, 12, 31))
                .groupBy("TO_CHAR(MONTH, 'YYYY-MM')")
                .orderByAsc("TO_CHAR(MONTH, 'YYYY-MM')");
        applyScope(w);
        return recordMapper.selectMaps(w).stream()
                .map(row -> new MonthlyPoint(str(row, "M"), dec(row, "NET"), dec(row, "TOT")))
                .toList();
    }

    private static String str(Map<String, Object> row, String key) {
        Object v = get(row, key);
        return v == null ? null : String.valueOf(v).trim();
    }

    private static BigDecimal dec(Map<String, Object> row, String key) {
        Object v = get(row, key);
        return v == null ? null : new BigDecimal(String.valueOf(v)).setScale(2, RoundingMode.HALF_UP);
    }

    private static Object get(Map<String, Object> row, String key) {
        for (Map.Entry<String, Object> e : row.entrySet()) {
            if (e.getKey().equalsIgnoreCase(key)) return e.getValue();
        }
        return null;
    }

    private void applyScope(QueryWrapper<SalaryRecord> w) {
        List<String> scope = permissionService.salaryScopeGrades();
        if (scope == null) return;
        if (scope.isEmpty()) w.eq("ID", -1L);
        else w.in("GRADE", scope);
    }

    private void applyScopeLambda(LambdaQueryWrapper<SalaryRecord> w) {
        List<String> scope = permissionService.salaryScopeGrades();
        if (scope == null) return;
        if (scope.isEmpty()) w.eq(SalaryRecord::getId, -1L);
        else w.in(SalaryRecord::getGrade, scope);
    }

    private String gradeSqlClause() {
        List<String> scope = permissionService.salaryScopeGrades();
        if (scope == null) return "";
        if (scope.isEmpty()) return " AND 1=0";
        return " AND r.GRADE IN (" + scope.stream()
                .map(g -> "'" + g.replace("'", "''") + "'")
                .collect(Collectors.joining(",")) + ")";
    }
}
