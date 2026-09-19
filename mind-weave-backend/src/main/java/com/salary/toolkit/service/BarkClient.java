package com.salary.toolkit.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Bark 推送客户端：GET {barkUrl}/{title}/{body}
 */
@Component
public class BarkClient {
    private final HttpClient client;
    private final ObjectMapper mapper = new ObjectMapper();

    public BarkClient() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    }

    BarkClient(HttpClient client) {
        this.client = client;
    }

    public boolean send(String barkUrl, String title, String body) {
        if (barkUrl == null || barkUrl.isBlank()) return false;
        try {
            String url = trimSlash(barkUrl) + "/" + enc(title) + "/" + enc(body) + "?group=" + enc("MindWeave 日程");
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) return false;
            JsonNode result = mapper.readTree(resp.body());
            return result != null && result.path("code").asInt(-1) == 200;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private static String trimSlash(String url) {
        while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        return url;
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
