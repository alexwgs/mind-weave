package com.salary.community.dto;

import lombok.Data;

@Data
public class PublicPostRequest {
    private String nickname;
    private String content;
    private String visitorToken;
}
