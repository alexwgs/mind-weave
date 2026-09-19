package com.salary.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * 前端 SPA 路由回退：非 /api 且非带点静态资源的路径统一转发到 index.html。
 */
@Controller
public class SpaController {
    @GetMapping(value = {"/{path:[^\\.]*}", "/**/{path:[^\\.]*}"})
    public String forward(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if ("/api".equals(uri) || uri.startsWith("/api/")) {
            return "forward:/error";
        }
        return "forward:/index.html";
    }
}
