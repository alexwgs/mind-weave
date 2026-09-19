package com.salary.toolkit.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TodoReq {
    private String title;
    private String project;
    private String priority;
    private LocalDateTime dueTime;
    private LocalDateTime remindTime;
    private String remindNote;
    private Integer done;
    private String recurRule;
    private List<SubReq> subs;

    @Data
    public static class SubReq {
        private Long id;
        private String title;
        private Integer done;
    }
}
