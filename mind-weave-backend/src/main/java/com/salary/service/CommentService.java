package com.salary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.BizException;
import com.salary.dto.CommentDTO;
import com.salary.dto.CommentRequest;
import com.salary.entity.SalaryComment;
import com.salary.entity.SalaryRecord;
import com.salary.mapper.SalaryCommentMapper;
import com.salary.mapper.SalaryRecordMapper;
import com.salary.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommentService {
    private final SalaryCommentMapper commentMapper;
    private final SalaryRecordMapper recordMapper;
    private final LogService logService;
    private final PermissionService permissionService;

    public Page<CommentDTO> page(int page, int size, Integer year, String fieldCode, String keyword) {
        permissionService.require("comments");
        LambdaQueryWrapper<SalaryComment> w = new LambdaQueryWrapper<>();
        if (year != null) {
            w.exists("SELECT 1 FROM SLR_SALARY_RECORD r WHERE r.ID = SLR_SALARY_COMMENT.RECORD_ID "
                    + "AND TO_CHAR(r.MONTH, 'YYYY') = {0}", String.valueOf(year));
        }
        w.eq(fieldCode != null && !fieldCode.isBlank(), SalaryComment::getFieldCode, fieldCode);
        w.like(keyword != null && !keyword.isBlank(), SalaryComment::getContent, keyword);
        w.orderByDesc(SalaryComment::getId);
        Page<SalaryComment> p = commentMapper.selectPage(new Page<>(page, size), w);

        Page<CommentDTO> result = new Page<>(p.getCurrent(), p.getSize(), p.getTotal());
        if (!p.getRecords().isEmpty()) {
            List<Long> ids = p.getRecords().stream().map(SalaryComment::getRecordId).distinct().toList();
            Map<Long, String> months = recordMapper.selectBatchIds(ids).stream()
                    .collect(Collectors.toMap(SalaryRecord::getId,
                            r -> r.getMonth().toString()));
            result.setRecords(p.getRecords().stream().map(c -> toDTO(c, months.get(c.getRecordId()))).toList());
        }
        return result;
    }

    @Transactional
    public CommentDTO create(CommentRequest req) {
        permissionService.require("comments.create");
        SalaryRecord record = recordMapper.selectById(req.getRecordId());
        if (record == null) throw new BizException("工资记录不存在");
        SalaryComment c = new SalaryComment();
        c.setRecordId(req.getRecordId());
        c.setFieldCode(req.getFieldCode().trim().toUpperCase());
        c.setAuthor(SecurityUtils.currentUsername());
        c.setContent(req.getContent().trim());
        c.setCreatedAt(LocalDateTime.now());
        c.setUpdatedAt(LocalDateTime.now());
        commentMapper.insert(c);
        logService.record(SecurityUtils.currentUsername(), "CREATE_COMMENT", "COMMENT", c.getId(),
                "新增批注 " + record.getMonth() + " 字段 " + c.getFieldCode());
        return toDTO(c, record.getMonth().toString());
    }

    @Transactional
    public CommentDTO update(Long id, CommentRequest req) {
        permissionService.require("comments.edit");
        SalaryComment exist = commentMapper.selectById(id);
        if (exist == null) throw new BizException("批注不存在");
        if (req.getRecordId() != null && !req.getRecordId().equals(exist.getRecordId())) {
            SalaryRecord record = recordMapper.selectById(req.getRecordId());
            if (record == null) throw new BizException("工资记录不存在");
            exist.setRecordId(req.getRecordId());
        }
        if (req.getFieldCode() != null && !req.getFieldCode().isBlank()) {
            exist.setFieldCode(req.getFieldCode().trim().toUpperCase());
        }
        if (req.getContent() != null && !req.getContent().isBlank()) {
            exist.setContent(req.getContent().trim());
        }
        exist.setUpdatedAt(LocalDateTime.now());
        commentMapper.updateById(exist);
        logService.record(SecurityUtils.currentUsername(), "UPDATE_COMMENT", "COMMENT", id, "修改批注");
        SalaryRecord record = recordMapper.selectById(exist.getRecordId());
        return toDTO(exist, record == null ? null : record.getMonth().toString());
    }

    @Transactional
    public void delete(Long id) {
        permissionService.require("comments.delete");
        SalaryComment exist = commentMapper.selectById(id);
        if (exist == null) throw new BizException("批注不存在");
        commentMapper.deleteById(id);
        logService.record(SecurityUtils.currentUsername(), "DELETE_COMMENT", "COMMENT", id, "删除批注");
    }

    private CommentDTO toDTO(SalaryComment c, String month) {
        CommentDTO dto = new CommentDTO();
        dto.setId(c.getId());
        dto.setRecordId(c.getRecordId());
        dto.setMonth(month == null ? null : java.time.LocalDate.parse(month));
        dto.setFieldCode(c.getFieldCode());
        dto.setAuthor(c.getAuthor());
        dto.setContent(c.getContent());
        dto.setItemsJson(c.getItemsJson());
        dto.setCreatedAt(c.getCreatedAt());
        return dto;
    }
}
