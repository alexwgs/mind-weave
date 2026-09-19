package com.salary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.entity.OperationLog;
import com.salary.mapper.OperationLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class LogService {
    private final OperationLogMapper logMapper;

    public void record(String operator, String action, String targetType, Long targetId, String detail) {
        OperationLog log = new OperationLog();
        log.setOperator(operator);
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setDetail(detail);
        log.setCreatedAt(LocalDateTime.now());
        logMapper.insert(log);
    }

    public Page<OperationLog> page(int page, int size, String operator, String action) {
        LambdaQueryWrapper<OperationLog> w = new LambdaQueryWrapper<>();
        w.like(operator != null && !operator.isBlank(), OperationLog::getOperator, operator)
         .like(action != null && !action.isBlank(), OperationLog::getAction, action)
         .orderByDesc(OperationLog::getId);
        return logMapper.selectPage(new Page<>(page, size), w);
    }
}
