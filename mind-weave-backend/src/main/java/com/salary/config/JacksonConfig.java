package com.salary.config;

import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalTimeSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.format.DateTimeFormatter;

/**
 * 全局统一日期时间格式：
 * 日期 yyyy-MM-dd，时间 HH:mm:ss，日期时间 yyyy-MM-dd HH:mm:ss
 */
@Configuration
public class JacksonConfig {
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
        DateTimeFormatter date = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        DateTimeFormatter dateTime = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        DateTimeFormatter time = DateTimeFormatter.ofPattern("HH:mm:ss");
        return builder -> builder.serializers(
                new LocalDateSerializer(date),
                new LocalDateTimeSerializer(dateTime),
                new LocalTimeSerializer(time));
    }
}
