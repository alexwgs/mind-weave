package com.salary.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                Claims claims = jwtUtil.parse(auth.substring(7));
                String username = claims.getSubject();
                String role = claims.get("role", String.class);
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                var token = new UsernamePasswordAuthenticationToken(username, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(token);
            } catch (JwtException | IllegalArgumentException e) {
                // 公开页面允许“可选登录”：浏览器残留过期令牌时退化为游客，
                // 不能让公开文章、聊天室或留言板被旧登录态挡住。
                if (isPublicRequest(request)) {
                    SecurityContextHolder.clearContext();
                    chain.doFilter(request, response);
                    return;
                }
                // 受保护接口仍返回 401，前端据此跳转登录页。
                response.setStatus(401);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"code\":1,\"message\":\"登录已过期，请重新登录\",\"data\":null}");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private static boolean isPublicRequest(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.equals("/api/auth/login")
                || path.equals("/api/auth/wx-login")
                || path.equals("/api/auth/wx-bind")
                || path.startsWith("/api/tool/share/")
                || path.startsWith("/api/tool/articles/public")
                || path.startsWith("/api/community/public/")
                || ("GET".equalsIgnoreCase(request.getMethod())
                    && path.matches("/api/tool/attachments/[^/]+/(content|download)"));
    }
}
