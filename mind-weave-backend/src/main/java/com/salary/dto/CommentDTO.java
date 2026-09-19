package com.salary.dto;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class CommentDTO {
    private Long id;
    private Long recordId;
    private LocalDate month;
    private String fieldCode;
    private String author;
    private String content;
    private String itemsJson;
    private LocalDateTime createdAt;
}
