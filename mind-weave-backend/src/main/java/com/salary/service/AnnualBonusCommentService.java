package com.salary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.salary.entity.SalaryComment;
import com.salary.entity.SalaryRecord;
import com.salary.mapper.SalaryCommentMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 年度奖金(AD)金额同步为"年度实发"(AF)字段上的批注：
 * 有值时批注为"税前年终奖：<金额>"，无值时删除该自动批注。
 */
@Service
@RequiredArgsConstructor
public class AnnualBonusCommentService {
    private static final String PREFIX = "税前年终奖：";
    private final SalaryCommentMapper commentMapper;

    public void sync(SalaryRecord record) {
        if (record == null || record.getId() == null) return;
        boolean hasBonus = record.getAnnualBonus() != null
                && record.getAnnualBonus().compareTo(BigDecimal.ZERO) != 0;
        List<SalaryComment> auto = commentMapper.selectList(new LambdaQueryWrapper<SalaryComment>()
                .eq(SalaryComment::getRecordId, record.getId())
                .eq(SalaryComment::getFieldCode, "AF")
                .likeRight(SalaryComment::getContent, PREFIX));
        if (hasBonus) {
            String expected = PREFIX + record.getAnnualBonus().toPlainString();
            if (auto.isEmpty()) {
                SalaryComment c = new SalaryComment();
                c.setRecordId(record.getId());
                c.setFieldCode("AF");
                c.setAuthor("system");
                c.setContent(expected);
                c.setCreatedAt(LocalDateTime.now());
                c.setUpdatedAt(LocalDateTime.now());
                commentMapper.insert(c);
            } else {
                SalaryComment first = auto.get(0);
                if (!expected.equals(first.getContent())) {
                    first.setContent(expected);
                    first.setUpdatedAt(LocalDateTime.now());
                    commentMapper.updateById(first);
                }
                for (int i = 1; i < auto.size(); i++) {
                    commentMapper.deleteById(auto.get(i).getId());
                }
            }
        } else {
            for (SalaryComment c : auto) {
                commentMapper.deleteById(c.getId());
            }
        }
    }
}
