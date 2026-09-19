package com.salary.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.salary.common.BizException;
import com.salary.toolkit.config.VaultCrypto;
import com.salary.toolkit.service.SettingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * 微信小程序登录：jscode2session 换取 openid
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WxClient {
    private final SettingService settingService;
    private final VaultCrypto vaultCrypto;
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();

    public String code2session(String code) {
        String appid = settingService.systemValue("wx.appid");
        String encSecret = settingService.systemValue("wx.secret");
        String secret = encSecret == null ? null : vaultCrypto.decrypt(encSecret);
        if (appid == null || appid.isBlank() || secret == null || secret.isBlank()) {
            throw new BizException("请先在系统设置中配置小程序 AppID 与 AppSecret");
        }
        if (code == null || code.isBlank()) throw new BizException("code 不能为空");
        try {
            String url = "https://api.weixin.qq.com/sns/jscode2session?appid=" + appid
                    + "&secret=" + secret + "&js_code=" + code + "&grant_type=authorization_code";
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(10)).GET().build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode node = mapper.readTree(resp.body());
            if (node.hasNonNull("errcode") && node.get("errcode").asInt() != 0) {
                throw new BizException("微信登录失败: " + node.path("errmsg").asText("errcode=" + node.path("errcode").asInt()));
            }
            String openid = node.path("openid").asText("");
            if (openid.isBlank()) throw new BizException("微信登录失败：未获取到 openid");
            return openid;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw new BizException("微信接口调用失败: " + e.getMessage());
        }
    }
}
