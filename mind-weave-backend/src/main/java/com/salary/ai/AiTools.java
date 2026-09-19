package com.salary.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.salary.common.BizException;
import com.salary.dto.RecordQuery;
import com.salary.security.SecurityUtils;
import com.salary.service.PermissionService;
import com.salary.service.SalaryService;
import com.salary.toolkit.dto.TodoReq;
import com.salary.toolkit.dto.VaultItemReq;
import com.salary.toolkit.entity.Todo;
import com.salary.toolkit.entity.TkArticle;
import com.salary.toolkit.service.ArticleService;
import com.salary.toolkit.service.TodoService;
import com.salary.toolkit.service.VaultService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AI 工具定义与执行（复用现有服务与权限校验）
 */
@Component
@RequiredArgsConstructor
public class AiTools {
    private final ObjectMapper mapper;
    private final TodoService todoService;
    private final ArticleService articleService;
    private final VaultService vaultService;
    private final SalaryService salaryService;
    private final PermissionService permissionService;

    public List<Map<String, Object>> definitions() {
        return List.of(
                tool("create_todo", "新建一条待办事项", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "title", Map.of("type", "string", "description", "待办标题"),
                                "project", Map.of("type", "string", "description", "项目/标签"),
                                "priority", Map.of("type", "string", "enum", List.of("HIGH", "MEDIUM", "LOW")),
                                "due_time", Map.of("type", "string", "description", "截止时间 YYYY-MM-DD HH:mm"),
                                "remind_time", Map.of("type", "string", "description", "提醒时间 YYYY-MM-DD HH:mm"),
                                "remind_note", Map.of("type", "string", "description", "提醒内容")),
                        "required", List.of("title"))),
                tool("query_todos", "查询待办列表", Map.of(
                        "type", "object",
                        "properties", Map.of("status", Map.of("type", "string", "enum", List.of("active", "done", "all"))),
                        "required", List.of())),
                tool("toggle_todo", "完成/取消完成一条待办", Map.of(
                        "type", "object",
                        "properties", Map.of("id", Map.of("type", "integer", "description", "待办 ID")),
                        "required", List.of("id"))),
                tool("query_salary", "查询工资记录汇总", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "year", Map.of("type", "integer", "description", "年份"),
                                "month", Map.of("type", "integer", "description", "月份 1-12（可选）")),
                        "required", List.of())),
                tool("query_articles", "检索知识库：按关键词在标题、摘要、标签与正文中查找，返回命中片段。"
                        + "想回答与笔记内容有关的问题时先用它定位文章，再用 read_article 读全文。", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "keyword", Map.of("type", "string", "description", "关键词，可为空以列出最近文章"),
                                "status", Map.of("type", "string", "enum", List.of("DRAFT", "PUBLISHED"), "description", "按状态筛选，可省略")),
                        "required", List.of())),
                tool("read_article", "读取一篇知识库文章的正文全文（先用 query_articles 拿到 id）", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "id", Map.of("type", "integer", "description", "文章 ID")),
                        "required", List.of("id"))),
                tool("create_article", "新建知识库文章", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "title", Map.of("type", "string"),
                                "content", Map.of("type", "string", "description", "Markdown 正文"),
                                "tags", Map.of("type", "string", "description", "逗号分隔"),
                                "status", Map.of("type", "string", "enum", List.of("DRAFT", "PUBLISHED"))),
                        "required", List.of("title", "content"))),
                tool("query_vault", "查询保险箱凭证（仅名称，不含密码）", Map.of(
                        "type", "object",
                        "properties", Map.of("keyword", Map.of("type", "string")),
                        "required", List.of())));
    }

    private Map<String, Object> tool(String name, String desc, Map<String, Object> params) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", "function");
        m.put("function", Map.of("name", name, "description", desc, "parameters", params));
        return m;
    }

    /** 执行工具调用，返回给模型的 JSON 字符串 */
    public String execute(String name, JsonNode args) {
        String username = SecurityUtils.currentUsername();
        try {
            switch (name) {
                case "create_todo": {
                    permissionService.require("todo.create");
                    TodoReq req = new TodoReq();
                    req.setTitle(text(args, "title"));
                    req.setProject(text(args, "project"));
                    req.setPriority(optText(args, "priority", "MEDIUM"));
                    req.setDueTime(time(args, "due_time"));
                    req.setRemindTime(time(args, "remind_time"));
                    req.setRemindNote(text(args, "remind_note"));
                    Todo t = todoService.create(req);
                    return json(Map.of("ok", true, "id", t.getId(), "title", t.getTitle()));
                }
                case "query_todos": {
                    String status = optText(args, "status", "active");
                    var page = todoService.page(1, 20, status, null, null, null);
                    return json(Map.of("count", page.getTotal(),
                            "items", page.getRecords().stream().map(t -> Map.of(
                                    "id", t.getId(), "title", t.getTitle(), "project", t.getProject(),
                                    "priority", t.getPriority(), "done", t.getDone(),
                                    "dueTime", String.valueOf(t.getDueTime()))).toList()));
                }
                case "toggle_todo": {
                    permissionService.require("todo.edit");
                    Todo t = todoService.toggle(args.get("id").asLong());
                    return json(Map.of("ok", true, "id", t.getId(), "done", t.getDone()));
                }
                case "query_salary": {
                    permissionService.require("records.view");
                    Integer year = args.hasNonNull("year") ? args.get("year").asInt() : null;
                    Integer month = args.hasNonNull("month") ? args.get("month").asInt() : null;
                    RecordQuery q = new RecordQuery();
                    q.setPage(1);
                    q.setSize(100);
                    if (year != null) {
                        q.setMonthFrom(year + "-" + (month == null ? "01" : String.format("%02d", month)));
                        q.setMonthTo(year + "-" + (month == null ? "12" : String.format("%02d", month)));
                    }
                    var page = salaryService.page(q);
                    double net = page.getRecords().stream().mapToDouble(r -> r.getNetPay() == null ? 0 : r.getNetPay().doubleValue()).sum();
                    double total = page.getRecords().stream().mapToDouble(r -> r.getTotalSalary() == null ? 0 : r.getTotalSalary().doubleValue()).sum();
                    return json(Map.of("count", page.getTotal(), "netSum", round(net), "totalSalarySum", round(total)));
                }
                case "query_articles": {
                    String kw = text(args, "keyword");
                    String st = text(args, "status");
                    var page = articleService.page(1, 20, st, null, null, kw, null, null);
                    List<Map<String, Object>> items = new java.util.ArrayList<>();
                    // 每篇都带正文片段会让返回体过大（长文可能有几十处命中），只给前几篇，其余靠 read_article 去读
                    int snippetBudget = 3;
                    for (TkArticle a : page.getRecords()) {
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("id", a.getId());
                        item.put("title", a.getTitle());
                        item.put("status", a.getStatus());
                        item.put("tags", a.getTags());
                        item.put("category", a.getCategoryPath());
                        item.put("updatedAt", String.valueOf(a.getUpdatedAt()));
                        item.put("summary", a.getSummary());
                        if (snippetBudget > 0) {
                            String hit = snippet(a, kw);
                            if (hit != null) {
                                item.put("matchInContent", hit);
                                snippetBudget--;
                            }
                        }
                        items.add(item);
                    }
                    return json(Map.of("count", page.getTotal(), "items", items));
                }
                case "read_article": {
                    if (!args.hasNonNull("id")) return json(Map.of("error", "缺少文章 id"));
                    TkArticle a = articleService.detail(args.get("id").asLong());
                    String full = plainText(a);
                    String content = full.length() > CONTENT_LIMIT ? full.substring(0, CONTENT_LIMIT) : full;
                    Map<String, Object> out = new LinkedHashMap<>();
                    out.put("id", a.getId());
                    out.put("title", a.getTitle());
                    out.put("status", a.getStatus());
                    out.put("tags", a.getTags());
                    out.put("category", a.getCategoryPath());
                    out.put("updatedAt", String.valueOf(a.getUpdatedAt()));
                    out.put("content", content);
                    out.put("totalChars", full.length());
                    if (full.length() > CONTENT_LIMIT) {
                        out.put("truncated", true);
                        out.put("note", "正文较长，仅返回前 " + CONTENT_LIMIT + " 字，可结合检索片段回答");
                    }
                    return json(out);
                }
                case "create_article": {
                    permissionService.require("article.create");
                    com.salary.toolkit.dto.ArticleReq req = new com.salary.toolkit.dto.ArticleReq();
                    req.setTitle(text(args, "title"));
                    req.setContentMd(text(args, "content"));
                    req.setTags(text(args, "tags"));
                    req.setStatus(optText(args, "status", "DRAFT"));
                    TkArticle a = articleService.create(req);
                    return json(Map.of("ok", true, "id", a.getId(), "title", a.getTitle(), "status", a.getStatus()));
                }
                case "query_vault": {
                    permissionService.require("vault.view");
                    String kw = text(args, "keyword");
                    var page = vaultService.pageItems(1, 20, null, kw);
                    return json(Map.of("count", page.getTotal(),
                            "items", page.getRecords().stream().map(v -> Map.of(
                                    "id", v.getId(), "name", v.getName(), "group", v.getGroupId())).toList()));
                }
                default:
                    throw new BizException("未知工具: " + name);
            }
        } catch (BizException e) {
            return json(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return json(Map.of("error", "执行失败: " + e.getMessage()));
        }
    }

    private String text(JsonNode args, String key) {
        return args.hasNonNull(key) ? args.get(key).asText() : null;
    }

    /** 正文最多回给模型多少字，避免一次塞爆上下文 */
    private static final int CONTENT_LIMIT = 12000;
    private static final int SNIPPET_RADIUS = 60;
    private static final int SNIPPET_LIMIT = 500;

    /** 正文去标记后的纯文本，模型读起来最省 token */
    private static String plainText(TkArticle a) {
        String raw = a.getContentMd();
        if (raw == null || raw.isBlank()) raw = a.getContentHtml();
        if (raw == null) return "";
        return raw
                .replaceAll("(?is)<(script|style)[^>]*>.*?</\\1>", " ")
                .replaceAll("<[^>]+>", " ")
                .replaceAll("```[\\s\\S]*?```", " ")
                .replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)", " ")
                .replaceAll("\\[([^\\]]*)\\]\\([^)]*\\)", "$1")
                .replaceAll("(?m)^\\s{0,3}#{1,6}\\s*", "")
                .replaceAll("[*_`~>]", "")
                .replaceAll("&nbsp;", " ")
                .replaceAll("&amp;", "&")
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("[\\t\\x0B\\f\\r ]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }

    /** 关键词在正文中的命中片段，用于"哪一篇更相关"的判断 */
    private static String snippet(TkArticle a, String keyword) {
        if (keyword == null || keyword.isBlank()) return null;
        String body = plainText(a);
        int at = body.toLowerCase().indexOf(keyword.toLowerCase());
        if (at < 0) return null;
        int from = Math.max(0, at - SNIPPET_RADIUS);
        int to = Math.min(body.length(), at + keyword.length() + SNIPPET_RADIUS);
        String piece = (from > 0 ? "…" : "") + body.substring(from, to).replaceAll("\\s+", " ") + (to < body.length() ? "…" : "");
        return piece.length() > SNIPPET_LIMIT ? piece.substring(0, SNIPPET_LIMIT) + "…" : piece;
    }

    private String optText(JsonNode args, String key, String def) {
        String v = text(args, key);
        return v == null || v.isBlank() ? def : v;
    }

    private LocalDateTime time(JsonNode args, String key) {
        String v = text(args, key);
        if (v == null || v.isBlank()) return null;
        try {
            return LocalDateTime.parse(v.trim().replace(' ', 'T'),
                    DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
        } catch (Exception e) {
            return null;
        }
    }

    private String json(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (Exception e) {
            return "{}";
        }
    }

    private double round(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
