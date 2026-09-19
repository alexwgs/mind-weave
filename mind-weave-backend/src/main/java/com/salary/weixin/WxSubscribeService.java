package com.salary.weixin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.salary.entity.AppUser;
import com.salary.mapper.AppUserMapper;
import com.salary.toolkit.config.VaultCrypto;
import com.salary.toolkit.service.SettingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * 微信小程序订阅消息推送（日程提醒模板）
 */
@Slf4j
@Service
public class WxSubscribeService {
    public static final String DEFAULT_TMPL_ID = "MaTS2FNCD0UiyBHsCVwgIRLvyJ9QXEcOOP22cpm69WU";

    private final SettingService settingService;
    private final VaultCrypto vaultCrypto;
    private final AppUserMapper userMapper;
    private final ObjectMapper mapper;
    private final HttpClient client;

    private volatile String accessToken;
    private volatile long tokenExpireAt = 0;
    private volatile String tokenAppid;
    private volatile String tokenSecret;

    public enum SendResult { SENT, FAILED, SKIPPED }

    @Autowired
    public WxSubscribeService(SettingService settingService, VaultCrypto vaultCrypto,
                              AppUserMapper userMapper, ObjectMapper mapper) {
        this(settingService, vaultCrypto, userMapper, mapper,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }

    WxSubscribeService(SettingService settingService, VaultCrypto vaultCrypto,
                       AppUserMapper userMapper, ObjectMapper mapper, HttpClient client) {
        this.settingService = settingService;
        this.vaultCrypto = vaultCrypto;
        this.userMapper = userMapper;
        this.mapper = mapper;
        this.client = client;
    }

    /** Configuration/binding only; WeChat subscription quota is checked by WeChat on send. */
    public boolean isConfigured(String owner) {
        String openid = openidOf(owner);
        String appid = settingService.systemValue("wx.appid");
        String secret = settingService.systemValue("wx.secret");
        return openid != null && !openid.isBlank() && appid != null && !appid.isBlank()
                && secret != null && !secret.isBlank();
    }

    public String templateId() {
        String value = settingService.systemValue("wx.subscribeTmpl");
        return value == null || value.isBlank() ? DEFAULT_TMPL_ID : value.trim();
    }

    /**
     * 给指定用户的微信发送待办提醒订阅消息（未绑定微信或未配置则静默跳过）
     */
    public SendResult sendReminder(String owner, String title, String dueTime, String content) {
        try {
            String openid = openidOf(owner);
            if (openid == null || openid.isBlank()) return SendResult.SKIPPED;
            String appid = settingService.systemValue("wx.appid");
            String enc = settingService.systemValue("wx.secret");
            String secret = enc == null ? null : vaultCrypto.decrypt(enc);
            if (appid == null || appid.isBlank() || secret == null || secret.isBlank()) return SendResult.SKIPPED;
            String tmpl = templateId();

            String token = accessToken(appid, secret);
            String body = mapper.writeValueAsString(Map.of(
                    "touser", openid,
                    "template_id", tmpl,
                    "page", "pages/todos/todos",
                    "data", Map.of(
                            "thing5", Map.of("value", cut(title, 20)),
                            "date9", Map.of("value", dueTime == null || dueTime.isBlank() || "无".equals(dueTime)
                                    ? java.time.LocalDateTime.now(com.salary.toolkit.service.ReminderSchedule.ZONE)
                                        .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : dueTime),
                            "thing2", Map.of("value", cut(content, 20)))));
            HttpRequest req = HttpRequest.newBuilder(
                            URI.create("https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=" + token))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode node = mapper.readTree(resp.body());
            int errcode = node == null ? -1 : node.path("errcode").asInt(-1);
            if (resp.statusCode() == 200 && errcode == 0) {
                log.info("微信订阅消息已发送，用户: {}", owner);
                return SendResult.SENT;
            } else {
                if (errcode == 40001 || errcode == 40014 || errcode == 42001) tokenExpireAt = 0;
                log.warn("微信订阅消息发送失败，用户: {}，HTTP: {}，错误码: {}", owner, resp.statusCode(), errcode);
                return SendResult.FAILED;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return SendResult.FAILED;
        } catch (Exception e) {
            log.warn("微信订阅消息发送异常，用户: {}，类型: {}", owner, e.getClass().getSimpleName());
            return SendResult.FAILED;
        }
    }

    private synchronized String accessToken(String appid, String secret) throws Exception {
        if (accessToken != null && appid.equals(tokenAppid) && secret.equals(tokenSecret)
                && System.currentTimeMillis() < tokenExpireAt) return accessToken;
        String url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid="
                + appid + "&secret=" + secret;
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10)).GET().build();
        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        JsonNode node = mapper.readTree(resp.body());
        if (resp.statusCode() != 200 || node == null || node.path("access_token").asText("").isBlank()) {
            throw new IllegalStateException("微信访问令牌获取失败");
        }
        accessToken = node.path("access_token").asText();
        tokenAppid = appid;
        tokenSecret = secret;
        tokenExpireAt = System.currentTimeMillis() + Math.max(0, node.path("expires_in").asInt(7200) - 300) * 1000L;
        return accessToken;
    }

    private String openidOf(String username) {
        AppUser u = userMapper.selectOne(new LambdaQueryWrapper<AppUser>()
                .eq(AppUser::getUsername, username));
        return u == null ? null : u.getOpenid();
    }

    private static String cut(String s, int n) {
        if (s == null) return "";
        int count = s.codePointCount(0, s.length());
        return count > n ? s.substring(0, s.offsetByCodePoints(0, n)) : s;
    }
}
