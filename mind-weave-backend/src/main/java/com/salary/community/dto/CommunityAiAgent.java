package com.salary.community.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CommunityAiAgent {
    private String id;
    private String name;
    private String prompt;
    private boolean enabled;
}
