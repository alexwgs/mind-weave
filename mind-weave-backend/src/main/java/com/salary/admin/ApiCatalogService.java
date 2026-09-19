package com.salary.admin;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.MethodParameter;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ValueConstants;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.lang.annotation.Annotation;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ApiCatalogService {
    private static final DefaultParameterNameDiscoverer PARAMETER_NAMES = new DefaultParameterNameDiscoverer();
    private static final Pattern PATH_VARIABLE = Pattern.compile("\\{([^}:]+)(?::[^}]+)?}");
    private static final Map<String, String> MODULES = Map.ofEntries(
            Map.entry("AiController", "AI 助手"), Map.entry("AuthController", "身份认证"),
            Map.entry("WxAuthController", "微信认证"), Map.entry("RecordController", "工资记录"),
            Map.entry("CommentController", "字段批注"), Map.entry("StatsController", "统计分析"),
            Map.entry("ImportController", "数据导入"), Map.entry("ExportController", "数据导出"),
            Map.entry("UserController", "用户管理"), Map.entry("PermissionController", "权限管理"),
            Map.entry("LogController", "操作日志"), Map.entry("VaultController", "保险箱"),
            Map.entry("ArticleController", "知识库"), Map.entry("AttachmentController", "附件"),
            Map.entry("ShareController", "文章分享"), Map.entry("TodoController", "日程待办"),
            Map.entry("RpgController", "人生 RPG"), Map.entry("SettingController", "系统设置"),
            Map.entry("UnlockController", "小程序解锁"), Map.entry("ApiManagementController", "API 管理")
    );
    private static final Map<String, String> ACTIONS = Map.ofEntries(
            Map.entry("page", "分页查询"), Map.entry("list", "查询列表"), Map.entry("detail", "查看详情"),
            Map.entry("create", "新建数据"), Map.entry("update", "更新数据"), Map.entry("delete", "删除数据"),
            Map.entry("login", "账号登录"), Map.entry("me", "获取当前用户"), Map.entry("changePassword", "修改密码"),
            Map.entry("wxLogin", "微信登录"), Map.entry("wxBind", "绑定微信"), Map.entry("overview", "获取概览"),
            Map.entry("annual", "获取年度统计"), Map.entry("trend", "获取月度趋势"), Map.entry("preview", "预览导入"),
            Map.entry("execute", "执行导入"), Map.entry("batches", "查询导入批次"), Map.entry("export", "导出数据"),
            Map.entry("resetPassword", "重置密码"), Map.entry("roleDefaults", "查询角色权限"),
            Map.entry("chat", "AI 对话"), Map.entry("config", "读取配置"), Map.entry("test", "测试连接"),
            Map.entry("categories", "查询分类"), Map.entry("createCategory", "新建分类"),
            Map.entry("updateCategory", "更新分类"), Map.entry("deleteCategory", "删除分类"),
            Map.entry("publicPage", "查询公开文章"), Map.entry("publicCategories", "查询公开分类"),
            Map.entry("publicDetail", "查看公开文章"), Map.entry("covers", "查询文章封面"),
            Map.entry("share", "创建分享"), Map.entry("disableShare", "关闭分享"), Map.entry("access", "访问分享"),
            Map.entry("accessPost", "验证分享"), Map.entry("upload", "上传附件"), Map.entry("download", "下载附件"),
            Map.entry("content", "读取附件内容"), Map.entry("groups", "查询分组"),
            Map.entry("groupSummary", "查询分组统计"), Map.entry("createGroup", "新建分组"),
            Map.entry("updateGroup", "更新分组"), Map.entry("deleteGroup", "删除分组"),
            Map.entry("items", "查询项目"), Map.entry("reveal", "查看敏感内容"), Map.entry("setPin", "设置 PIN"),
            Map.entry("verifyPin", "验证 PIN"), Map.entry("calendar", "查询日历"), Map.entry("projects", "查询项目标签"),
            Map.entry("schedulerStatus", "查询推送状态"), Map.entry("summary", "查询汇总"),
            Map.entry("subscriptionGranted", "刷新订阅授权"), Map.entry("toggle", "切换完成状态"),
            Map.entry("toggleSub", "切换子任务"), Map.entry("createHabit", "创建习惯"),
            Map.entry("toggleToday", "今日打卡"), Map.entry("deleteHabit", "删除习惯"), Map.entry("get", "读取设置"),
            Map.entry("put", "保存设置"), Map.entry("testBark", "测试 Bark"), Map.entry("wxConfig", "读取微信配置"),
            Map.entry("save", "保存配置"), Map.entry("verify", "验证凭证"), Map.entry("catalog", "查询 API 目录"),
            Map.entry("setEnabled", "启停 API")
    );
    private static final Set<Class<?>> SIMPLE = Set.of(String.class, Integer.class, Long.class, Double.class,
            Float.class, Boolean.class, Short.class, Byte.class, Character.class);

    private final RequestMappingHandlerMapping mappings;
    private final ApiToggleService toggleService;

    public ApiCatalogService(@Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings,
                             ApiToggleService toggleService) {
        this.mappings = mappings;
        this.toggleService = toggleService;
    }

    public Map<String, Object> catalog() {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : mappings.getHandlerMethods().entrySet()) {
            HandlerMethod handler = entry.getValue();
            if (!handler.getBeanType().getPackageName().startsWith("com.salary")) continue;
            for (String path : entry.getKey().getPatternValues()) {
                if (!path.startsWith("/api/")) continue;
                Set<RequestMethod> declared = entry.getKey().getMethodsCondition().getMethods();
                if (declared.isEmpty()) continue;
                for (RequestMethod method : declared) items.add(describe(method.name(), path, handler));
            }
        }
        items.sort(Comparator.comparing((Map<String, Object> item) -> String.valueOf(item.get("module")))
                .thenComparing(item -> String.valueOf(item.get("path")))
                .thenComparing(item -> String.valueOf(item.get("method"))));
        Map<String, Long> modules = new LinkedHashMap<>();
        for (Map<String, Object> item : items) modules.merge(String.valueOf(item.get("module")), 1L, Long::sum);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("generatedAt", LocalDateTime.now().toString());
        result.put("total", items.size());
        result.put("moduleCount", modules.size());
        result.put("publicCount", items.stream().filter(i -> Boolean.TRUE.equals(i.get("publicApi"))).count());
        result.put("disabledCount", items.stream().filter(i -> !Boolean.TRUE.equals(i.get("enabled"))).count());
        result.put("modules", modules);
        result.put("items", items);
        return result;
    }

    public boolean exists(String method, String path) {
        return ((List<?>) catalog().get("items")).stream().map(Map.class::cast)
                .anyMatch(item -> method.equalsIgnoreCase(String.valueOf(item.get("method")))
                        && path.equals(item.get("path")));
    }

    private Map<String, Object> describe(String method, String path, HandlerMethod handler) {
        String controller = handler.getBeanType().getSimpleName();
        String module = MODULES.getOrDefault(controller, controller.replace("Controller", ""));
        String action = ACTIONS.getOrDefault(handler.getMethod().getName(), handler.getMethod().getName());
        boolean publicApi = publicApi(method, path);
        String permission = permission(method, path, publicApi);
        PreAuthorize rule = AnnotatedElementUtils.findMergedAnnotation(handler.getMethod(), PreAuthorize.class);
        if (rule == null) rule = AnnotatedElementUtils.findMergedAnnotation(handler.getBeanType(), PreAuthorize.class);
        boolean protectedEndpoint = toggleService.protectedEndpoint(path);
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", toggleService.endpointId(method, path));
        item.put("module", module);
        item.put("name", module + " · " + action);
        item.put("description", action + "。" + (publicApi ? "无需登录即可访问。" : "需要有效登录态。")
                + ("登录用户".equals(permission) || "公开".equals(permission) ? "" : "需要权限：" + permission + "。"));
        item.put("method", method);
        item.put("path", path);
        item.put("publicApi", publicApi);
        item.put("permission", permission);
        item.put("accessRule", rule == null ? null : rule.value());
        item.put("enabled", protectedEndpoint || !toggleService.isDisabled(method, path));
        item.put("protectedEndpoint", protectedEndpoint);
        item.put("risk", "GET".equals(method) ? "READ" : "DELETE".equals(method) ? "HIGH" : "WRITE");
        item.put("parameters", parameters(handler, path));
        item.put("requestBody", requestBody(handler));
        item.put("responseType", typeName(handler.getMethod().getGenericReturnType()));
        item.put("source", controller + "#" + handler.getMethod().getName());
        return item;
    }

    private List<Map<String, Object>> parameters(HandlerMethod handler, String endpointPath) {
        List<Map<String, Object>> result = new ArrayList<>();
        List<String> pathVariables = pathVariables(endpointPath);
        int pathVariableIndex = 0;
        for (MethodParameter parameter : handler.getMethodParameters()) {
            parameter.initParameterNameDiscovery(PARAMETER_NAMES);
            PathVariable path = parameter.getParameterAnnotation(PathVariable.class);
            RequestParam query = parameter.getParameterAnnotation(RequestParam.class);
            RequestPart part = parameter.getParameterAnnotation(RequestPart.class);
            if (parameter.hasParameterAnnotation(RequestBody.class)) continue;
            if (path != null) {
                String fallback = pathVariableIndex < pathVariables.size() ? pathVariables.get(pathVariableIndex) : null;
                pathVariableIndex++;
                result.add(parameter(parameterName(path.value(), parameter, fallback), "path", parameter.getParameterType(), path.required(), null));
            }
            else if (query != null) result.add(parameter(parameterName(query.value(), parameter),
                    MultipartFile.class.isAssignableFrom(parameter.getParameterType()) ? "file" : "query",
                    parameter.getParameterType(), query.required() && ValueConstants.DEFAULT_NONE.equals(query.defaultValue()), cleanDefault(query.defaultValue())));
            else if (part != null) result.add(parameter(parameterName(part.value(), parameter), "file", parameter.getParameterType(), part.required(), null));
            else if (isSimple(parameter.getParameterType())) result.add(parameter(parameter.getParameterName(), "query", parameter.getParameterType(), false, null));
            else for (Field field : fields(parameter.getParameterType()))
                result.add(parameter(field.getName(), "query", field.getType(), required(field.getAnnotations()), null));
        }
        return result;
    }

    private static List<String> pathVariables(String path) {
        List<String> names = new ArrayList<>();
        Matcher matcher = PATH_VARIABLE.matcher(path);
        while (matcher.find()) names.add(matcher.group(1));
        return names;
    }

    private Map<String, Object> requestBody(HandlerMethod handler) {
        for (MethodParameter parameter : handler.getMethodParameters()) {
            RequestBody body = parameter.getParameterAnnotation(RequestBody.class);
            if (body == null) continue;
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("type", typeName(parameter.getGenericParameterType()));
            result.put("required", body.required());
            result.put("flexible", Map.class.isAssignableFrom(parameter.getParameterType()));
            List<Map<String, Object>> docs = new ArrayList<>();
            for (Field field : fields(parameter.getParameterType())) {
                Map<String, Object> doc = new LinkedHashMap<>();
                doc.put("name", field.getName());
                doc.put("type", typeName(field.getGenericType()));
                doc.put("required", required(field.getAnnotations()));
                doc.put("description", fieldDescription(field.getName()));
                docs.add(doc);
            }
            result.put("fields", docs);
            return result;
        }
        return null;
    }

    private static Map<String, Object> parameter(String name, String location, Class<?> type, boolean required, String defaultValue) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("name", name == null ? "参数" : name);
        item.put("location", location);
        item.put("type", typeName(type));
        item.put("required", required);
        item.put("defaultValue", defaultValue);
        item.put("description", fieldDescription(name));
        return item;
    }

    private static List<Field> fields(Class<?> type) {
        if (type == null || isSimple(type) || Map.class.isAssignableFrom(type) || type.getPackageName().startsWith("java.")) return List.of();
        List<Field> result = new ArrayList<>();
        for (Field field : type.getDeclaredFields()) if (!Modifier.isStatic(field.getModifiers()) && !field.isSynthetic()) result.add(field);
        return result;
    }

    private static boolean required(Annotation[] annotations) {
        for (Annotation annotation : annotations) {
            String name = annotation.annotationType().getSimpleName();
            if (name.equals("NotNull") || name.equals("NotBlank") || name.equals("NotEmpty")) return true;
        }
        return false;
    }

    private static boolean isSimple(Class<?> type) {
        return type.isPrimitive() || type.isEnum() || SIMPLE.contains(type) || Number.class.isAssignableFrom(type);
    }

    private static String parameterName(String annotationName, MethodParameter parameter) {
        return parameterName(annotationName, parameter, null);
    }

    private static String parameterName(String annotationName, MethodParameter parameter, String fallback) {
        if (annotationName != null && !annotationName.isBlank()) return annotationName;
        String discovered = parameter.getParameterName();
        if (discovered != null && !discovered.isBlank()) return discovered;
        return fallback;
    }

    private static String cleanDefault(String value) {
        return value == null || ValueConstants.DEFAULT_NONE.equals(value) ? null : value;
    }

    private static String typeName(Type type) {
        if (type instanceof Class<?> clazz) {
            if (clazz.isArray()) return typeName(clazz.getComponentType()) + "[]";
            return clazz.getSimpleName();
        }
        if (type instanceof ParameterizedType generic) {
            StringBuilder out = new StringBuilder(typeName(generic.getRawType())).append('<');
            for (int i = 0; i < generic.getActualTypeArguments().length; i++) {
                if (i > 0) out.append(", ");
                out.append(typeName(generic.getActualTypeArguments()[i]));
            }
            return out.append('>').toString();
        }
        String text = type.getTypeName();
        return text.substring(text.lastIndexOf('.') + 1);
    }

    private static boolean publicApi(String method, String path) {
        return path.equals("/api/auth/login") || path.equals("/api/auth/wx-login") || path.equals("/api/auth/wx-bind")
                || path.startsWith("/api/tool/share/") || path.startsWith("/api/tool/articles/public")
                || path.startsWith("/api/community/public/")
                || ("GET".equals(method) && path.matches("/api/tool/attachments/\\{[^}]+}/(content|download)"));
    }

    private static String permission(String method, String path, boolean publicApi) {
        if (publicApi) return "公开";
        if (path.equals("/api/admin/apis") && "GET".equals(method)) return "apis";
        if (path.startsWith("/api/admin/apis")) return "apis.manage";
        if (path.startsWith("/api/community/admin")) return "community.manage";
        if (path.startsWith("/api/users") || path.startsWith("/api/permissions")) return "users.manage";
        if (path.startsWith("/api/logs")) return "logs.view";
        if (path.startsWith("/api/tool/settings") || path.startsWith("/api/ai/config") || path.startsWith("/api/ai/test")) return "settings.manage";
        if (path.startsWith("/api/records")) return crudPermission("records", method);
        if (path.startsWith("/api/comments")) return "GET".equals(method) ? "comments" : crudPermission("comments", method);
        if (path.startsWith("/api/import")) return "POST".equals(method) ? "import.execute" : "import";
        if (path.startsWith("/api/export")) return "records.export";
        if (path.startsWith("/api/stats")) return "stats";
        if (path.startsWith("/api/tool/vault")) {
            if ("GET".equals(method) || path.endsWith("/pin/verify") || path.endsWith("/pin")) return "vault.view";
            return crudPermission("vault", method);
        }
        if (path.startsWith("/api/tool/categories")) return "GET".equals(method) ? "article.view" : "article.edit";
        if (path.startsWith("/api/tool/articles")) {
            if ("GET".equals(method)) return "article.view";
            if (path.endsWith("/share")) return "article.edit";
            if ("POST".equals(method) && path.equals("/api/tool/articles")) return "article.create";
            if ("POST".equals(method)) return "article.edit";
            return crudPermission("article", method);
        }
        if (path.startsWith("/api/tool/todos")) {
            if ("GET".equals(method) || path.endsWith("/subscription-granted")) return "todos";
            if ("POST".equals(method) && path.equals("/api/tool/todos")) return "todo.create";
            if ("POST".equals(method)) return "todo.edit";
            return crudPermission("todo", method);
        }
        if (path.startsWith("/api/tool/attachments")) return "DELETE".equals(method) ? "article.edit / vault.delete" : "article.edit / vault.create";
        if (path.startsWith("/api/tool/rpg")) return "home";
        if (path.startsWith("/api/ai/chat") || path.startsWith("/api/tool/unlock")) return "登录用户";
        return "登录用户";
    }

    private static String crudPermission(String prefix, String method) {
        return switch (method) {
            case "POST" -> prefix + ".create";
            case "PUT", "PATCH" -> prefix + ".edit";
            case "DELETE" -> prefix + ".delete";
            default -> prefix + ".view";
        };
    }

    private static String fieldDescription(String name) {
        if (name == null) return "接口参数";
        return Map.ofEntries(Map.entry("id", "数据 ID"), Map.entry("sid", "子任务 ID"), Map.entry("title", "标题"),
                Map.entry("name", "名称"), Map.entry("username", "用户名"), Map.entry("password", "密码"),
                Map.entry("page", "页码，从 1 开始"), Map.entry("size", "每页条数"), Map.entry("keyword", "搜索关键词"),
                Map.entry("status", "状态筛选"), Map.entry("priority", "优先级"), Map.entry("project", "项目标签"),
                Map.entry("month", "月份，格式 YYYY-MM"), Map.entry("file", "上传文件"), Map.entry("mode", "执行模式"),
                Map.entry("yearFrom", "起始年份"), Map.entry("yearTo", "结束年份"), Map.entry("token", "分享令牌"),
                Map.entry("pin", "保险箱 PIN"), Map.entry("done", "完成状态，0 未完成、1 已完成"),
                Map.entry("dueTime", "截止时间"), Map.entry("remindTime", "提醒时间"), Map.entry("recurRule", "六段 Cron 循环规则"))
                .getOrDefault(name, "请求字段 " + name);
    }
}
