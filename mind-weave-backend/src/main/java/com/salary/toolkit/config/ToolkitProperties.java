package com.salary.toolkit.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "toolkit")
public class ToolkitProperties {
    /** 附件存储根目录，生产环境建议 /vol1/1000/dev/uploads */
    private String uploadDir = "./uploads";
    /** 凭证加密密钥，生产环境务必通过环境变量 SALARY_VAULT_KEY 注入 */
    private String vaultKey = "salary-dev-key-change-me-1234567890";
    /** 单文件大小上限（MB） */
    private long maxFileMb = 100;
}
