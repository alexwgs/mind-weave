package com.salary.community.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.salary.toolkit.entity.TkSetting;
import com.salary.toolkit.mapper.TkSettingMapper;
import com.salary.toolkit.service.BarkClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** 新的待审核内容写入成功后，通知所有已启用 Bark 的管理者。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ModerationNotificationService {
    private final TkSettingMapper settingMapper;
    private final BarkClient barkClient;

    @Async
    public void pending(String module, String author, String content) {
        try {
            List<TkSetting> settings = settingMapper.selectList(new LambdaQueryWrapper<TkSetting>()
                    .in(TkSetting::getSetKey, List.of("bark.url", "bark.enabled")));
            Set<String> disabled = new HashSet<>();
            settings.stream().filter(s -> "bark.enabled".equals(s.getSetKey())
                            && "false".equalsIgnoreCase(s.getSetValue()))
                    .forEach(s -> disabled.add(s.getOwner()));
            String preview = content == null ? "" : content.replaceAll("\\s+", " ").trim();
            if (preview.length() > 180) preview = preview.substring(0, 180) + "…";
            String body = "模块：" + module + "\n提交者：" + author + "\n内容：" + preview;
            settings.stream().filter(s -> "bark.url".equals(s.getSetKey()))
                    .filter(s -> s.getSetValue() != null && !s.getSetValue().isBlank())
                    .filter(s -> !disabled.contains(s.getOwner()))
                    .map(TkSetting::getSetValue).map(String::trim).distinct()
                    .forEach(url -> barkClient.send(url, "有新的待审核内容", body, "MindWeave 互动审核"));
        } catch (Exception e) {
            log.warn("互动审核 Bark 通知失败：{}", e.getClass().getSimpleName());
        }
    }
}
