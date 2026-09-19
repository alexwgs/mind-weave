package com.salary.toolkit.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.salary.security.SecurityUtils;
import com.salary.toolkit.dto.SettingVO;
import com.salary.toolkit.entity.TkSetting;
import com.salary.toolkit.mapper.TkSettingMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SettingService {
    private final TkSettingMapper settingMapper;
    private final BarkClient barkClient;
    private final com.salary.service.PermissionService permissionService;
    private final com.salary.toolkit.config.VaultCrypto vaultCrypto;
    private final com.salary.service.LogService logService;

    private String owner() {
        return SecurityUtils.currentUsername();
    }

    public SettingVO get() {
        permissionService.require("settings.manage");
        SettingVO vo = new SettingVO();
        vo.setBarkUrl(value("bark.url"));
        vo.setDigestTime(value("todo.digest"));
        vo.setBarkEnabled(!"false".equalsIgnoreCase(value("bark.enabled")));
        vo.setPinSet(value("vault.pin") != null);
        String siteName = systemValue("site.name");
        vo.setSiteName(siteName == null || siteName.isBlank() || "小招成长记".equals(siteName)
                ? "MindWeave · 织脑" : siteName);
        vo.setAnnouncement(systemValue("site.announcement"));
        vo.setFooter(systemValue("site.footer"));
        return vo;
    }

    public void put(Map<String, String> body) {
        permissionService.require("settings.manage");
        if (body == null) return;
        if (body.containsKey("barkUrl")) upsert("bark.url", validateBarkUrl(body.get("barkUrl")));
        if (body.containsKey("digestTime")) upsert("todo.digest", validateDigest(body.get("digestTime")));
        if (body.containsKey("barkEnabled")) upsert("bark.enabled", body.get("barkEnabled"));
        if (body.containsKey("siteName")) upsertSystem("site.name", body.get("siteName"));
        if (body.containsKey("announcement")) upsertSystem("site.announcement", body.get("announcement"));
        if (body.containsKey("footer")) upsertSystem("site.footer", body.get("footer"));
        if (body.containsKey("aiProvider")) upsertSystem("ai.provider", body.get("aiProvider"));
        if (body.containsKey("aiModel")) upsertSystem("ai.model", body.get("aiModel"));
        if (body.containsKey("aiBaseUrl")) upsertSystem("ai.baseUrl", body.get("aiBaseUrl"));
        if (body.containsKey("aiApiKey")) {
            String v = body.get("aiApiKey");
            if (v != null && !v.isBlank() && !v.contains("****")) {
                upsertSystem("ai.apiKey", vaultCrypto.encrypt(v));
            }
        }
        if (body.containsKey("wxAppid")) upsertSystem("wx.appid", body.get("wxAppid"));
        if (body.containsKey("wxSecret")) {
            String v = body.get("wxSecret");
            if (v != null && !v.isBlank() && !v.contains("****")) {
                upsertSystem("wx.secret", vaultCrypto.encrypt(v));
            }
        }
        logService.record(owner(), "UPDATE_SETTINGS", "SETTINGS", null, "修改系统设置：" + String.join(",", body.keySet()));
    }

    public boolean testBark(String barkUrl) {
        permissionService.require("settings.manage");
        String url = barkUrl == null || barkUrl.isBlank() ? value("bark.url") : barkUrl;
        if (url == null || url.isBlank()) throw new com.salary.common.BizException("请先配置 Bark 地址");
        logService.record(owner(), "TEST_BARK", "SETTINGS", null, "发送 Bark 测试推送");
        return barkClient.send(validateBarkUrl(url), "MindWeave 测试推送", "日程待办推送链路正常");
    }

    public String value(String key) {
        TkSetting s = settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, owner()).eq(TkSetting::getSetKey, key));
        return s == null ? null : s.getSetValue();
    }

    public void upsert(String key, String value) {
        TkSetting s = settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, owner()).eq(TkSetting::getSetKey, key));
        if (s == null) {
            s = new TkSetting();
            s.setOwner(owner());
            s.setSetKey(key);
            s.setSetValue(value);
            s.setUpdatedAt(LocalDateTime.now(ReminderSchedule.ZONE));
            settingMapper.insert(s);
        } else {
            s.setSetValue(value);
            s.setUpdatedAt(LocalDateTime.now(ReminderSchedule.ZONE));
            settingMapper.updateById(s);
        }
    }

    public String systemValue(String key) {
        TkSetting s = settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, "system").eq(TkSetting::getSetKey, key));
        return s == null ? null : s.getSetValue();
    }

    public void upsertSystem(String key, String value) {
        TkSetting s = settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, "system").eq(TkSetting::getSetKey, key));
        if (s == null) {
            s = new TkSetting();
            s.setOwner("system");
            s.setSetKey(key);
            s.setSetValue(value);
            s.setUpdatedAt(LocalDateTime.now());
            settingMapper.insert(s);
        } else {
            s.setSetValue(value);
            s.setUpdatedAt(LocalDateTime.now());
            settingMapper.updateById(s);
        }
    }

    public Map<String, Object> aiConfig() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("provider", systemValue("ai.provider") == null ? "deepseek" : systemValue("ai.provider"));
        m.put("model", systemValue("ai.model") == null ? "deepseek-chat" : systemValue("ai.model"));
        m.put("baseUrl", systemValue("ai.baseUrl") == null ? "https://api.deepseek.com" : systemValue("ai.baseUrl"));
        String enc = systemValue("ai.apiKey");
        m.put("hasKey", enc != null && !enc.isBlank());
        m.put("keyMasked", enc == null ? "" : maskKey(vaultCrypto.decrypt(enc)));
        return m;
    }

    public Map<String, Object> wxConfig() {
        Map<String, Object> m = new LinkedHashMap<>();
        String appid = systemValue("wx.appid");
        String enc = systemValue("wx.secret");
        m.put("appid", appid == null ? "" : appid);
        m.put("hasSecret", enc != null && !enc.isBlank());
        return m;
    }

    private static String maskKey(String key) {
        if (key == null || key.length() < 8) return "已配置";
        return key.substring(0, 6) + "****" + key.substring(key.length() - 4);
    }

    private static String validateDigest(String value) {
        if (value == null || value.isBlank()) return "";
        try {
            return LocalTime.parse(value.trim()).toString().substring(0, 5);
        } catch (RuntimeException e) {
            throw new com.salary.common.BizException("每日汇总时间格式不正确，请使用 HH:mm");
        }
    }

    private static String validateBarkUrl(String value) {
        if (value == null || value.isBlank()) return "";
        String text = value.trim();
        try {
            URI uri = URI.create(text);
            if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException();
            }
            return text;
        } catch (RuntimeException e) {
            throw new com.salary.common.BizException("Bark 地址格式不正确，需要完整的 http(s) 地址");
        }
    }
}
