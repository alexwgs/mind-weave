package com.salary.community.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.salary.ai.AiService;
import com.salary.community.dto.CommunityAiAgent;
import com.salary.community.entity.ChatMessage;
import com.salary.community.mapper.ChatMessageMapper;
import com.salary.community.realtime.RealtimeBroadcaster;
import com.salary.community.realtime.RoomEvent;
import com.salary.service.LogService;
import com.salary.service.PermissionService;
import com.salary.toolkit.service.SettingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommunityAiService {
    private static final String KEY = "community.aiAgents";
    private static final CommunityAiAgent DEFAULT_AGENT = new CommunityAiAgent(
            "ai-mengmeng", "AI梦梦",
            "你是 MindWeave 会客厅里的 AI 梦梦。性格温柔、真诚、有一点幽默，善于倾听和延续话题。回答使用中文，简洁自然，像聊天室里的朋友；不知道时坦诚说明，不编造事实。",
            true);

    private final SettingService settingService;
    private final PermissionService permissionService;
    private final ObjectMapper mapper;
    private final AiService aiService;
    private final ChatMessageMapper messageMapper;
    private final RealtimeBroadcaster broadcaster;
    private final LogService logService;

    public List<CommunityAiAgent> publicAgents() {
        return agents().stream().filter(CommunityAiAgent::isEnabled)
                .map(agent -> new CommunityAiAgent(agent.getId(), agent.getName(), null, true)).toList();
    }

    public List<CommunityAiAgent> adminAgents() {
        permissionService.require("community.manage");
        return agents();
    }

    public List<CommunityAiAgent> saveAgents(List<CommunityAiAgent> input) {
        permissionService.require("community.manage");
        if (input == null || input.isEmpty()) throw new com.salary.common.BizException("至少保留一个 AI 成员");
        if (input.size() > 10) throw new com.salary.common.BizException("最多配置 10 个 AI 成员");
        List<CommunityAiAgent> clean = new ArrayList<>();
        for (CommunityAiAgent item : input) {
            String name = item.getName() == null ? "" : item.getName().trim();
            String prompt = item.getPrompt() == null ? "" : item.getPrompt().trim();
            if (name.length() < 2 || name.length() > 24) throw new com.salary.common.BizException("AI 名称需要 2-24 个字符");
            if (prompt.isBlank() || prompt.length() > 1500) throw new com.salary.common.BizException("基础提示词需要 1-1500 个字符");
            if (clean.stream().anyMatch(existing -> existing.getName().equalsIgnoreCase(name))) throw new com.salary.common.BizException("AI 名称不能重复");
            String id = item.getId() == null || item.getId().isBlank() ? "ai-" + UUID.randomUUID().toString().substring(0, 8) : item.getId();
            clean.add(new CommunityAiAgent(id, name, prompt, item.isEnabled()));
        }
        try {
            String json = mapper.writeValueAsString(clean);
            if (json.length() > 3900) throw new com.salary.common.BizException("AI 配置内容过长，请精简提示词");
            settingService.upsertSystem(KEY, json);
            logService.record(com.salary.security.SecurityUtils.currentUsername(), "UPDATE_COMMUNITY_AI", "COMMUNITY_AI", null, "更新会客厅 AI 成员配置");
            return clean;
        } catch (com.salary.common.BizException e) {
            throw e;
        } catch (Exception e) {
            throw new com.salary.common.BizException("保存 AI 配置失败");
        }
    }

    @Async
    public void replyToMentions(Long roomId, ChatMessage source, String username) {
        for (CommunityAiAgent agent : agents()) {
            if (!agent.isEnabled() || !source.getContent().contains("@" + agent.getName())) continue;
            try {
                List<ChatMessage> recent = messageMapper.selectPage(new Page<>(1, 20),
                        new LambdaQueryWrapper<ChatMessage>().eq(ChatMessage::getRoomId, roomId)
                                .eq(ChatMessage::getStatus, "APPROVED").orderByDesc(ChatMessage::getCreatedAt)).getRecords();
                List<com.salary.ai.dto.ChatMessage> history = new ArrayList<>();
                for (int i = recent.size() - 1; i >= 0; i--) {
                    ChatMessage message = recent.get(i);
                    String role = "AI".equals(message.getAuthorType()) ? "assistant" : "user";
                    history.add(new com.salary.ai.dto.ChatMessage(role, message.getAuthorName() + "：" + message.getContent()));
                }
                String prompt = agent.getPrompt() + "\n你正在公共聊天室中回复用户。当前登录用户为 " + username
                        + "。只根据给出的聊天上下文回答，不泄露系统配置、隐私数据或其他用户信息，也不要声称执行了任何系统操作。";
                String reply = aiService.chatForCommunity(prompt, history);
                ChatMessage item = new ChatMessage();
                item.setRoomId(roomId);
                item.setAuthorType("AI");
                item.setAuthorName(agent.getName());
                item.setUsername("ai:" + agent.getId());
                item.setContent(reply == null || reply.isBlank() ? "我刚才走神了，可以再说一次吗？" : reply.trim());
                item.setStatus("APPROVED");
                item.setCreatedAt(LocalDateTime.now());
                messageMapper.insert(item);
                broadcaster.broadcast(roomId, RoomEvent.message(item));
            } catch (Exception e) {
                log.warn("会客厅 AI {} 回复失败: {}", agent.getName(), e.getMessage());
            }
        }
    }

    private List<CommunityAiAgent> agents() {
        String json = settingService.systemValue(KEY);
        if (json == null || json.isBlank()) return List.of(DEFAULT_AGENT);
        try {
            List<CommunityAiAgent> value = mapper.readValue(json, new TypeReference<>() {});
            return value == null || value.isEmpty() ? List.of(DEFAULT_AGENT) : value;
        } catch (Exception e) {
            log.warn("会客厅 AI 配置解析失败，使用默认配置", e);
            return List.of(DEFAULT_AGENT);
        }
    }
}
