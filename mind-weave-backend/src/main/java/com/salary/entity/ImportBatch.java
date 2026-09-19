package com.salary.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("SLR_IMPORT_BATCH")
public class ImportBatch {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String fileName;
    private LocalDateTime importTime;
    private String importBy;
    private Integer totalRows;
    private Integer okRows;
    private String warnMsg;
}
