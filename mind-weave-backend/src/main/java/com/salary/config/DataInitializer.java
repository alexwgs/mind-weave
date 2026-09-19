package com.salary.config;

import com.salary.service.AuthService;
import com.salary.service.PermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final AuthService authService;
    private final PermissionService permissionService;

    @Override
    public void run(String... args) {
        authService.seedAdminIfEmpty();
        permissionService.seed();
        log.info("MindWeave · 织脑已启动。默认管理员账号：admin / admin123");
    }
}
