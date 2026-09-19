package com.salary.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.salary.ai.dto.ChatMessage;
import com.salary.ai.dto.ChatResponse;
import com.salary.common.BizException;
import com.salary.security.SecurityUtils;
import com.salary.toolkit.config.VaultCrypto;
import com.salary.toolkit.service.SettingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {
    private final SettingService settingService;
    private final VaultCrypto vaultCrypto;
    private final AiTools aiTools;
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();

    private static final int MAX_ROUNDS = 6;

    public ChatResponse chat(List<ChatMessage> history) {
        String apiKey = decryptKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new BizException("请先在「系统设置 → AI 助手」中配置 DeepSeek API Key");
        }
        String model = settingService.systemValue("ai.model");
        if (model == null || model.isBlank()) model = "deepseek-chat";
        String baseUrl = settingService.systemValue("ai.baseUrl");
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://api.deepseek.com";

        List<Map<String, Object>> messages = new ArrayList<>();
        Map<String, Object> system = new LinkedHashMap<>();
        system.put("role", "system");
        system.put("content", systemPrompt());
        messages.add(system);
        if (history != null) {
            for (ChatMessage m : history) {
                if (m.getRole() == null || m.getContent() == null) continue;
                Map<String, Object> msg = new LinkedHashMap<>();
                msg.put("role", m.getRole());
                msg.put("content", m.getContent());
                messages.add(msg);
            }
        }

        List<String> actions = new ArrayList<>();
        for (int round = 0; round < MAX_ROUNDS; round++) {
            JsonNode resp = call(model, baseUrl, apiKey, messages);
            JsonNode choice = resp.path("choices").get(0);
            JsonNode message = choice.path("message");
            JsonNode toolCalls = message.path("tool_calls");
            if (toolCalls.isArray() && toolCalls.size() > 0) {
                Map<String, Object> assistant = new LinkedHashMap<>();
                assistant.put("role", "assistant");
                assistant.put("content", message.path("content").asText(""));
                List<Map<String, Object>> calls = new ArrayList<>();
                for (JsonNode tc : toolCalls) {
                    String id = tc.path("id").asText();
                    String fname = tc.path("function").path("name").asText();
                    String fargs = tc.path("function").path("arguments").asText();
                    Map<String, Object> call = new LinkedHashMap<>();
                    call.put("id", id);
                    call.put("type", "function");
                    call.put("function", Map.of("name", fname, "arguments", fargs));
                    calls.add(call);
                }
                assistant.put("tool_calls", calls);
                // 注意协议顺序：assistant(tool_calls) 必须排在 tool 消息之前
                messages.add(assistant);
                for (JsonNode tc : toolCalls) {
                    String id = tc.path("id").asText();
                    String fname = tc.path("function").path("name").asText();
                    String fargs = tc.path("function").path("arguments").asText();
                    JsonNode fargsNode;
                    try {
                        fargsNode = mapper.readTree(fargs == null || fargs.isBlank() ? "{}" : fargs);
                    } catch (Exception ex) {
                        fargsNode = mapper.createObjectNode();
                    }
                    String result = aiTools.execute(fname, fargsNode);
                    actions.add(fname + " → " + result);
                    Map<String, Object> toolMsg = new LinkedHashMap<>();
                    toolMsg.put("role", "tool");
                    toolMsg.put("tool_call_id", id);
                    toolMsg.put("content", result);
                    messages.add(toolMsg);
                }
                continue;
            }
            String reply = message.path("content").asText("（无回复）");
            return new ChatResponse(reply, actions);
        }
        throw new BizException("AI 处理轮次过多，请简化问题");
    }

    public boolean test(String apiKey, String model, String baseUrl) {
        String key = apiKey == null || apiKey.isBlank() ? decryptKey() : apiKey;
        if (key == null || key.isBlank()) throw new BizException("请先配置 API Key");
        String m = (model == null || model.isBlank()) ? "deepseek-chat" : model;
        String base = (baseUrl == null || baseUrl.isBlank()) ? "https://api.deepseek.com" : baseUrl;
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of("role", "user", "content", "你好，请回复：连接成功"));
        try {
            JsonNode resp = call(m, base, key, messages);
            String content = resp.path("choices").get(0).path("message").path("content").asText("");
            return !content.isBlank();
        } catch (Exception e) {
            log.error("AI 测试失败", e);
            throw new BizException("连接失败: " + e.getMessage());
        }
    }

    private JsonNode call(String model, String baseUrl, String apiKey, List<Map<String, Object>> messages) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("messages", messages);
            body.put("temperature", 0.3);
            body.put("max_tokens", 2000);
            body.put("tools", aiTools.definitions());
            body.put("tool_choice", "auto");
            String url = trimSlash(baseUrl) + "/chat/completions";
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(90))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode node = mapper.readTree(resp.body());
            if (resp.statusCode() != 200) {
                throw new BizException("AI 接口错误 " + resp.statusCode() + ": " + node.path("error").path("message").asText(resp.body()));
            }
            return node;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw new BizException("AI 调用失败: " + e.getMessage());
        }
    }

    private String systemPrompt() {
        String user = SecurityUtils.currentUsername();
        return "你是「MindWeave · 织脑」的 AI 助手，是用户第二大脑与智能体网络的一部分。当前用户是 " + user + "。"
                + "你可以调用工具帮助用户完成以下事情：新建/查询/完成待办事项、查询工资记录汇总、"
                + "检索与阅读知识库文章、新建知识库文章、查询保险箱凭证（注意不要输出任何密码等敏感字段）。"
                + "关于知识库：当用户问到他写过的笔记、方案、资料，或“我之前是怎么做的”这类问题时，"
                + "先用 query_articles 检索（关键词会命中标题、摘要、标签与正文），拿到 id 后再用 read_article 读全文，"
                + "然后基于正文原文回答，并说明结论来自哪几篇文章。"
                + "你只能看到当前用户自己名下的文章；若检索不到，就如实说明没有找到相关笔记，不要编造内容。"
                + "回答用中文，简洁友好。需要执行操作时调用对应工具，执行结果返回后向用户清晰说明。"
                + "用户询问薪资时先说明数据范围，再给出汇总金额（元）。";
    }

    private String decryptKey() {
        String enc = settingService.systemValue("ai.apiKey");
        return enc == null ? null : vaultCrypto.decrypt(enc);
    }

    private static String trimSlash(String url) {
        while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        return url;
    }
}
