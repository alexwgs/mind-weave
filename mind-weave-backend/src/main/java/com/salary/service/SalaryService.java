package com.salary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.BizException;
import com.salary.dto.RecordQuery;
import com.salary.entity.SalaryComment;
import com.salary.entity.SalaryRecord;
import com.salary.mapper.SalaryCommentMapper;
import com.salary.mapper.SalaryRecordMapper;
import com.salary.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SalaryService {
    private final SalaryRecordMapper recordMapper;
    private final SalaryCommentMapper commentMapper;
    private final LogService logService;
    private final AnnualBonusCommentService annualBonusCommentService;
    private final PermissionService permissionService;

    private static final Map<String, String> SORT_MAP = Map.ofEntries(
            Map.entry("month", "MONTH"),
            Map.entry("grade", "GRADE"),
            Map.entry("postSalary", "POST_SALARY"),
            Map.entry("bonus", "BONUS"),
            Map.entry("overtimePay", "OVERTIME_PAY"),
            Map.entry("otherAdjust", "OTHER_ADJUST"),
            Map.entry("totalIncome", "TOTAL_INCOME"),
            Map.entry("totalDeduction", "TOTAL_DEDUCTION"),
            Map.entry("netPay", "NET_PAY"),
            Map.entry("totalSalary", "TOTAL_SALARY"),
            Map.entry("companyTotal", "COMPANY_TOTAL"),
            Map.entry("otherBonus", "OTHER_BONUS"),
            Map.entry("annualBonusNet", "ANNUAL_BONUS_NET"),
            Map.entry("extraTotal", "(NVL(OTHER_BONUS,0)+NVL(ANNUAL_BONUS_NET,0))"));

    public Page<SalaryRecord> page(RecordQuery q) {
        permissionService.require("records.view");
        Page<SalaryRecord> page = recordMapper.selectPage(
                new Page<>(q.getPage() == null ? 1 : q.getPage(),
                        q.getSize() == null ? 12 : q.getSize()),
                buildWrapper(q));
        attachComments(page.getRecords());
        return page;
    }

    public List<SalaryRecord> listAll(RecordQuery q) {
        permissionService.require("records.view");
        List<SalaryRecord> list = recordMapper.selectList(buildWrapper(q));
        attachComments(list);
        return list;
    }

    public SalaryRecord detail(Long id) {
        permissionService.require("records.view");
        SalaryRecord record = recordMapper.selectById(id);
        if (record == null) throw new BizException("记录不存在");
        List<String> scope = permissionService.salaryScopeGrades();
        if (scope != null && (scope.isEmpty() || !scope.contains(record.getGrade()))) {
            throw new BizException("无权限查看该记录");
        }
        List<SalaryComment> comments = commentMapper.selectList(
                new LambdaQueryWrapper<SalaryComment>()
                        .eq(SalaryComment::getRecordId, id)
                        .orderByAsc(SalaryComment::getFieldCode));
        record.setComments(comments);
        record.setCommentCount(comments.size());
        return record;
    }

    @Transactional
    public SalaryRecord create(SalaryRecord req) {
        permissionService.require("records.create");
        if (req.getMonth() == null) throw new BizException("月份不能为空");
        LocalDate firstDay = req.getMonth().withDayOfMonth(1);
        if (recordMapper.selectCount(new LambdaQueryWrapper<SalaryRecord>()
                .eq(SalaryRecord::getMonth, firstDay)) > 0) {
            throw new BizException(firstDay + " 的工资记录已存在");
        }
        req.setId(null);
        req.setMonth(firstDay);
        computeTotals(req);
        req.setCreatedAt(LocalDateTime.now());
        req.setUpdatedAt(LocalDateTime.now());
        recordMapper.insert(req);
        annualBonusCommentService.sync(req);
        logService.record(SecurityUtils.currentUsername(), "CREATE_RECORD", "RECORD", req.getId(),
                "新增工资记录 " + firstDay);
        return req;
    }

    @Transactional
    public SalaryRecord update(Long id, SalaryRecord req) {
        permissionService.require("records.edit");
        SalaryRecord exist = recordMapper.selectById(id);
        if (exist == null) throw new BizException("记录不存在");
        merge(exist, req);
        if (exist.getMonth() != null) {
            exist.setMonth(exist.getMonth().withDayOfMonth(1));
        }
        computeTotals(exist);
        exist.setUpdatedAt(LocalDateTime.now());
        recordMapper.updateById(exist);
        annualBonusCommentService.sync(exist);
        logService.record(SecurityUtils.currentUsername(), "UPDATE_RECORD", "RECORD", id,
                "修改工资记录 " + exist.getMonth());
        return detail(id);
    }

    private void merge(SalaryRecord target, SalaryRecord src) {
        if (src.getMonth() != null) target.setMonth(src.getMonth());
        if (src.getGrade() != null) target.setGrade(src.getGrade());
        if (src.getPostSalary() != null) target.setPostSalary(src.getPostSalary());
        if (src.getRegionAllowance() != null) target.setRegionAllowance(src.getRegionAllowance());
        if (src.getBonus() != null) target.setBonus(src.getBonus());
        if (src.getOtherIncome() != null) target.setOtherIncome(src.getOtherIncome());
        if (src.getPostSubsidy() != null) target.setPostSubsidy(src.getPostSubsidy());
        if (src.getOvertimePay() != null) target.setOvertimePay(src.getOvertimePay());
        if (src.getHousingSubsidy() != null) target.setHousingSubsidy(src.getHousingSubsidy());
        if (src.getWorkAllowance() != null) target.setWorkAllowance(src.getWorkAllowance());
        if (src.getOtherAdjust() != null) target.setOtherAdjust(src.getOtherAdjust());
        if (src.getPensionPersonal() != null) target.setPensionPersonal(src.getPensionPersonal());
        if (src.getUnemploymentPersonal() != null) target.setUnemploymentPersonal(src.getUnemploymentPersonal());
        if (src.getMedicalPersonal() != null) target.setMedicalPersonal(src.getMedicalPersonal());
        if (src.getHousingFundPersonal() != null) target.setHousingFundPersonal(src.getHousingFundPersonal());
        if (src.getAnnuityPersonal() != null) target.setAnnuityPersonal(src.getAnnuityPersonal());
        if (src.getIncomeTax() != null) target.setIncomeTax(src.getIncomeTax());
        if (src.getPensionCompany() != null) target.setPensionCompany(src.getPensionCompany());
        if (src.getUnemploymentCompany() != null) target.setUnemploymentCompany(src.getUnemploymentCompany());
        if (src.getMedicalCompany() != null) target.setMedicalCompany(src.getMedicalCompany());
        if (src.getInjuryCompany() != null) target.setInjuryCompany(src.getInjuryCompany());
        if (src.getMaternityCompany() != null) target.setMaternityCompany(src.getMaternityCompany());
        if (src.getHousingFundCompany() != null) target.setHousingFundCompany(src.getHousingFundCompany());
        if (src.getAnnuityCompany() != null) target.setAnnuityCompany(src.getAnnuityCompany());
        if (src.getOtherBonus() != null) target.setOtherBonus(src.getOtherBonus());
        if (src.getAnnualBonus() != null) target.setAnnualBonus(src.getAnnualBonus());
        if (src.getAnnualBonusTax() != null) target.setAnnualBonusTax(src.getAnnualBonusTax());
        if (src.getAnnualBonusNet() != null) target.setAnnualBonusNet(src.getAnnualBonusNet());
    }

    @Transactional
    public void delete(Long id) {
        permissionService.require("records.delete");
        SalaryRecord exist = recordMapper.selectById(id);
        if (exist == null) throw new BizException("记录不存在");
        commentMapper.delete(new LambdaQueryWrapper<SalaryComment>()
                .eq(SalaryComment::getRecordId, id));
        recordMapper.deleteById(id);
        logService.record(SecurityUtils.currentUsername(), "DELETE_RECORD", "RECORD", id,
                "删除工资记录 " + exist.getMonth());
    }

    public static void computeTotals(SalaryRecord r) {
        r.setTotalIncome(sum(r.getPostSalary(), r.getRegionAllowance(), r.getBonus(),
                r.getOtherIncome(), r.getPostSubsidy(), r.getOvertimePay(),
                r.getHousingSubsidy(), r.getWorkAllowance(), r.getOtherAdjust()));
        r.setTotalDeduction(sum(r.getPensionPersonal(), r.getUnemploymentPersonal(),
                r.getMedicalPersonal(), r.getHousingFundPersonal(),
                r.getAnnuityPersonal(), r.getIncomeTax()));
        r.setNetPay(sub(r.getTotalIncome(), r.getTotalDeduction()));
        r.setCompanyTotal(sum(r.getPensionCompany(), r.getUnemploymentCompany(),
                r.getMedicalCompany(), r.getInjuryCompany(), r.getMaternityCompany(),
                r.getHousingFundCompany(), r.getAnnuityCompany()));
        r.setTotalSalary(sum(r.getNetPay(), r.getOtherBonus(), r.getAnnualBonusNet()));
    }

    private static BigDecimal sum(BigDecimal... vals) {
        BigDecimal s = BigDecimal.ZERO;
        for (BigDecimal v : vals) {
            if (v != null) s = s.add(v);
        }
        return s.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private static BigDecimal sub(BigDecimal a, BigDecimal b) {
        return (a == null ? BigDecimal.ZERO : a)
                .subtract(b == null ? BigDecimal.ZERO : b)
                .setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private QueryWrapper<SalaryRecord> buildWrapper(RecordQuery q) {
        QueryWrapper<SalaryRecord> w = new QueryWrapper<>();
        List<String> scope = permissionService.salaryScopeGrades();
        if (scope != null) {
            if (scope.isEmpty()) w.eq("ID", -1L);
            else w.in("GRADE", scope);
        }
        if (q.getYear() != null) {
            w.between("MONTH", LocalDate.of(q.getYear(), 1, 1), LocalDate.of(q.getYear(), 12, 31));
        }
        if (q.getMonthFrom() != null && !q.getMonthFrom().isBlank()) {
            w.ge("MONTH", LocalDate.parse(q.getMonthFrom() + "-01"));
        }
        if (q.getMonthTo() != null && !q.getMonthTo().isBlank()) {
            w.le("MONTH", LocalDate.parse(q.getMonthTo() + "-01"));
        }
        if (q.getGrade() != null && !q.getGrade().isBlank()) {
            w.eq("GRADE", q.getGrade());
        }
        if (q.getMinNetPay() != null) {
            w.ge("NET_PAY", q.getMinNetPay());
        }
        if (q.getMaxNetPay() != null) {
            w.le("NET_PAY", q.getMaxNetPay());
        }
        if (Boolean.TRUE.equals(q.getHasComment())) {
            w.exists("SELECT 1 FROM SLR_SALARY_COMMENT c WHERE c.RECORD_ID = SLR_SALARY_RECORD.ID");
        } else if (Boolean.FALSE.equals(q.getHasComment())) {
            w.notExists("SELECT 1 FROM SLR_SALARY_COMMENT c WHERE c.RECORD_ID = SLR_SALARY_RECORD.ID");
        }
        if (q.getKeyword() != null && !q.getKeyword().isBlank()) {
            w.exists("SELECT 1 FROM SLR_SALARY_COMMENT c WHERE c.RECORD_ID = SLR_SALARY_RECORD.ID AND c.CONTENT LIKE '%' || {0} || '%'", q.getKeyword());
        }
        String sortCol = q.getSortField() == null ? null : SORT_MAP.get(q.getSortField());
        if (sortCol != null) {
            boolean asc = !"desc".equalsIgnoreCase(q.getSortOrder());
            w.orderBy(true, asc, sortCol);
        } else {
            w.orderByDesc("MONTH");
        }
        return w;
    }

    private void attachComments(List<SalaryRecord> records) {
        if (records == null || records.isEmpty()) return;
        List<Long> ids = records.stream().map(SalaryRecord::getId).toList();
        Map<Long, List<SalaryComment>> grouped = commentMapper.selectList(
                        new LambdaQueryWrapper<SalaryComment>()
                                .in(SalaryComment::getRecordId, ids)
                                .orderByAsc(SalaryComment::getFieldCode))
                .stream().collect(Collectors.groupingBy(SalaryComment::getRecordId));
        for (SalaryRecord r : records) {
            List<SalaryComment> list = grouped.getOrDefault(r.getId(), List.of());
            r.setComments(list);
            r.setCommentCount(list.size());
        }
    }
}
