package com.salary.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.salary.common.BizException;
import com.salary.toolkit.entity.TkSetting;
import com.salary.toolkit.mapper.TkSettingMapper;
import com.salary.toolkit.service.ReminderSchedule;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.AntPathMatcher;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ApiToggleService {
    private static final String PREFIX = "api.disabled.";
    private static final Set<String> METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE");
    private final TkSettingMapper settingMapper;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();
    private volatile Set<String> disabled = Set.of();
    private volatile long loadedAt;

    public boolean isDisabled(String method, String path) {
        return disabledEntries().contains(signature(method, path));
    }

    public boolean isRequestDisabled(String method, String requestPath) {
        if ("OPTIONS".equalsIgnoreCase(method) || protectedEndpoint(requestPath)) return false;
        for (String entry : disabledEntries()) {
            int split = entry.indexOf(' ');
            if (split < 1) continue;
            String savedMethod = entry.substring(0, split);
            String pattern = entry.substring(split + 1);
            if (savedMethod.equalsIgnoreCase(method) && pathMatcher.match(pattern, requestPath)) return true;
        }
        return false;
    }

    public synchronized void setEnabled(String method, String path, boolean enabled) {
        String normalized = signature(method, path);
        if (protectedEndpoint(path)) throw new BizException("保护接口不能停用");
        String key = PREFIX + endpointId(method, path);
        TkSetting existing = settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, "system").eq(TkSetting::getSetKey, key));
        if (enabled) {
            if (existing != null) settingMapper.deleteById(existing.getId());
        } else if (existing == null) {
            TkSetting row = new TkSetting();
            row.setOwner("system");
            row.setSetKey(key);
            row.setSetValue(normalized);
            row.setUpdatedAt(LocalDateTime.now(ReminderSchedule.ZONE));
            settingMapper.insert(row);
        } else {
            existing.setSetValue(normalized);
            existing.setUpdatedAt(LocalDateTime.now(ReminderSchedule.ZONE));
            settingMapper.updateById(existing);
        }
        loadedAt = 0;
        disabledEntries();
    }

    public boolean protectedEndpoint(String path) {
        return path != null && (path.startsWith("/api/auth/") || path.startsWith("/api/admin/apis"));
    }

    public String endpointId(String method, String path) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(signature(method, path).getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (int i = 0; i < 12; i++) out.append(String.format("%02x", digest[i]));
            return out.toString();
        } catch (Exception e) {
            throw new IllegalStateException("无法生成接口标识", e);
        }
    }

    private Set<String> disabledEntries() {
        long now = System.currentTimeMillis();
        if (loadedAt > 0 && now - loadedAt < 10_000) return disabled;
        synchronized (this) {
            if (loadedAt > 0 && now - loadedAt < 10_000) return disabled;
            List<TkSetting> rows = settingMapper.selectList(new LambdaQueryWrapper<TkSetting>()
                    .eq(TkSetting::getOwner, "system").likeRight(TkSetting::getSetKey, PREFIX));
            Set<String> next = new LinkedHashSet<>();
            for (TkSetting row : rows) {
                if (row.getSetValue() != null && !row.getSetValue().isBlank()) next.add(row.getSetValue().trim());
            }
            disabled = Set.copyOf(next);
            loadedAt = now;
            return disabled;
        }
    }

    private static String signature(String method, String path) {
        String verb = method == null ? "" : method.trim().toUpperCase(Locale.ROOT);
        String route = path == null ? "" : path.trim();
        if (!METHODS.contains(verb) || !route.startsWith("/api/")) throw new BizException("接口标识不正确");
        return verb + " " + route;
    }
}
