package com.salary;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

import java.util.TimeZone;

@SpringBootApplication
@MapperScan({"com.salary.mapper", "com.salary.toolkit.mapper", "com.salary.community.mapper"})
@EnableMethodSecurity
@EnableScheduling
@EnableAsync
public class SalaryApplication {
    public static void main(String[] args) {
        // 固定时区为 Asia/Shanghai，避免容器时区不一致导致定时推送错时
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Shanghai"));
        SpringApplication.run(SalaryApplication.class, args);
    }
}
