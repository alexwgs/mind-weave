package com.salary.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CommentRequest {
    @NotNull(message = "记录ID不能为空")
    private Long recordId;
    @NotBlank(message = "字段不能为空")
    private String fieldCode;
    @NotBlank(message = "批注内容不能为空")
    private String content;
}
