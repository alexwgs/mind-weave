package com.salary.toolkit.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.salary.common.BizException;
import com.salary.security.SecurityUtils;
import com.salary.toolkit.dto.RpgHabitReq;
import com.salary.toolkit.entity.TkArticle;
import com.salary.toolkit.entity.TkSetting;
import com.salary.toolkit.entity.Todo;
import com.salary.toolkit.entity.VaultItem;
import com.salary.toolkit.mapper.TkArticleMapper;
import com.salary.toolkit.mapper.TkSettingMapper;
import com.salary.toolkit.mapper.TodoMapper;
import com.salary.toolkit.mapper.VaultItemMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RpgService {
    private static final String HABIT_PREFIX = "rpg.habit.";
    private static final String CHECKIN_PREFIX = "rpg.checkin.";
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final List<String> COLORS = List.of("violet", "mint", "coral", "gold", "blue");

    private final TodoMapper todoMapper;
    private final TkArticleMapper articleMapper;
    private final VaultItemMapper vaultItemMapper;
    private final TkSettingMapper settingMapper;
    private final ObjectMapper objectMapper;
    private final com.salary.service.PermissionService permissionService;
    private final com.salary.service.LogService logService;

    private String owner() {
        return SecurityUtils.currentUsername();
    }

    public Map<String, Object> overview() {
        permissionService.require("home");
        String owner = owner();
        long doneTodos = countTodos(owner, 1);
        long activeTodos = countTodos(owner, 0);
        long articles = articleMapper.selectCount(new LambdaQueryWrapper<TkArticle>()
                .eq(TkArticle::getOwner, owner).eq(TkArticle::getStatus, "PUBLISHED"));
        long vaultItems = vaultItemMapper.selectCount(new LambdaQueryWrapper<VaultItem>()
                .eq(VaultItem::getOwner, owner));

        List<TkSetting> habitRows = settings(owner, HABIT_PREFIX);
        List<TkSetting> checkinRows = settings(owner, CHECKIN_PREFIX);
        Map<String, Set<LocalDate>> datesByHabit = checkinDates(checkinRows);
        List<Map<String, Object>> habits = habitRows.stream()
                .map(row -> habitView(row, datesByHabit.getOrDefault(habitId(row), Set.of())))
                .sorted(Comparator.comparing(h -> String.valueOf(h.get("createdAt"))))
                .toList();

        long checkins = checkinRows.size();
        long executionXp = doneTodos * 15 + checkins * 6;
        long knowledgeXp = articles * 25;
        long orderXp = vaultItems * 8;
        long rhythmXp = checkins * 10;
        long totalXp = executionXp + knowledgeXp + orderXp + rhythmXp;
        int level = (int) (totalXp / 100) + 1;
        int levelXp = (int) (totalXp % 100);
        int bestStreak = habits.stream().mapToInt(h -> ((Number) h.get("bestStreak")).intValue()).max().orElse(0);
        long checkedToday = habits.stream().filter(h -> Boolean.TRUE.equals(h.get("checkedToday"))).count();

        List<Map<String, Object>> skills = List.of(
                skill("execution", "执行力", "把想法变成完成", "⚡", "violet", executionXp),
                skill("knowledge", "知识力", "让经验沉淀成网络", "✦", "blue", knowledgeXp),
                skill("order", "秩序力", "把重要信息安放妥当", "◇", "mint", orderXp),
                skill("rhythm", "节律力", "用重复塑造长期变化", "◉", "coral", rhythmXp)
        );

        long skillsAt2 = skills.stream().filter(s -> ((Number) s.get("level")).intValue() >= 2).count();
        long skillsAt5 = skills.stream().filter(s -> ((Number) s.get("level")).intValue() >= 5).count();
        List<Map<String, Object>> achievements = List.of(
                badge("quest", "first-step", "第一步", "完成第一件待办", "足", doneTodos, 1),
                badge("quest", "quest-hunter", "任务猎人", "累计完成 10 件待办", "剑", doneTodos, 10),
                badge("quest", "execution-veteran", "执行百炼", "累计完成 50 件待办", "刃", doneTodos, 50),
                badge("quest", "century-quest", "百事皆成", "累计完成 100 件待办", "鼎", doneTodos, 100),
                badge("knowledge", "first-note", "第一片记忆", "发布第一篇知识文章", "页", articles, 1),
                badge("knowledge", "knowledge-seed", "知识播种者", "发布 5 篇知识文章", "芽", articles, 5),
                badge("knowledge", "knowledge-garden", "知识成林", "发布 20 篇知识文章", "林", articles, 20),
                badge("order", "keeper", "秩序守护者", "收好 5 条重要凭证", "盾", vaultItems, 5),
                badge("order", "archive-master", "万物有位", "收好 20 条重要凭证", "匣", vaultItems, 20),
                badge("rhythm", "first-checkin", "初次共振", "完成第一次习惯打卡", "点", checkins, 1),
                badge("rhythm", "rhythm-3", "节律初成", "连续打卡 3 天", "焰", bestStreak, 3),
                badge("rhythm", "rhythm-7", "七日不坠", "连续打卡 7 天", "冠", bestStreak, 7),
                badge("rhythm", "rhythm-30", "月轮不息", "连续打卡 30 天", "月", bestStreak, 30),
                badge("rhythm", "checkin-50", "五十次回响", "累计完成 50 次习惯打卡", "环", checkins, 50),
                badge("rhythm", "checkin-200", "恒常之心", "累计完成 200 次习惯打卡", "恒", checkins, 200),
                badge("growth", "habit-trinity", "三线并行", "同时经营 3 个每日习惯", "弦", habits.size(), 3),
                badge("growth", "level-5", "渐入织境", "成长等级达到 5 级", "阶", level, 5),
                badge("growth", "level-10", "心智编织师", "成长等级达到 10 级", "梭", level, 10),
                badge("growth", "level-20", "织境远行者", "成长等级达到 20 级", "星", level, 20),
                badge("growth", "weaver", "四线织者", "四项技能都升到 2 级", "织", skillsAt2, 4),
                badge("growth", "master-weaver", "全域织造", "四项技能都升到 5 级", "璇", skillsAt5, 4)
        );

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("level", level);
        profile.put("title", titleFor(level));
        profile.put("totalXp", totalXp);
        profile.put("levelXp", levelXp);
        profile.put("nextLevelXp", 100);
        profile.put("bestStreak", bestStreak);
        profile.put("unlockedBadges", achievements.stream().filter(a -> Boolean.TRUE.equals(a.get("unlocked"))).count());

        Map<String, Object> quest = new LinkedHashMap<>();
        quest.put("habitTotal", habits.size());
        quest.put("checkedToday", checkedToday);
        quest.put("activeTodos", activeTodos);
        quest.put("complete", !habits.isEmpty() && checkedToday == habits.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("profile", profile);
        result.put("dailyQuest", quest);
        result.put("habits", habits);
        result.put("skills", skills);
        result.put("achievements", achievements);
        return result;
    }

    @Transactional
    public Map<String, Object> createHabit(RpgHabitReq req) {
        permissionService.require("home");
        if (req == null || req.getName() == null || req.getName().isBlank()) throw new BizException("请填写习惯名称");
        if (req.getName().trim().length() > 30) throw new BizException("习惯名称不能超过 30 个字");
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("name", req.getName().trim());
        value.put("emoji", cleanEmoji(req.getEmoji()));
        value.put("color", COLORS.contains(req.getColor()) ? req.getColor() : "violet");
        value.put("createdAt", LocalDateTime.now(ZONE).toString());
        insertSetting(owner(), HABIT_PREFIX + id, json(value));
        logService.record(owner(), "CREATE_RPG_HABIT", "RPG_HABIT", null, "创建习惯 " + req.getName().trim());
        return overview();
    }

    @Transactional
    public Map<String, Object> toggleToday(String id) {
        permissionService.require("home");
        TkSetting habit = ownedHabit(id);
        String key = CHECKIN_PREFIX + id + "." + LocalDate.now(ZONE);
        TkSetting existing = settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, owner()).eq(TkSetting::getSetKey, key));
        if (existing == null) insertSetting(owner(), key, "1");
        else settingMapper.deleteById(existing.getId());
        logService.record(owner(), "TOGGLE_RPG_HABIT", "RPG_HABIT", habit.getId(),
                (existing == null ? "完成今日打卡 " : "取消今日打卡 ") + habitName(habit));
        return overview();
    }

    @Transactional
    public Map<String, Object> deleteHabit(String id) {
        permissionService.require("home");
        TkSetting habit = ownedHabit(id);
        String name = habitName(habit);
        settingMapper.deleteById(habit.getId());
        settingMapper.delete(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, owner()).likeRight(TkSetting::getSetKey, CHECKIN_PREFIX + id + "."));
        logService.record(owner(), "DELETE_RPG_HABIT", "RPG_HABIT", habit.getId(), "删除习惯 " + name);
        return overview();
    }

    private long countTodos(String owner, int done) {
        return todoMapper.selectCount(new LambdaQueryWrapper<Todo>()
                .eq(Todo::getOwner, owner).eq(Todo::getDone, done));
    }

    private List<TkSetting> settings(String owner, String prefix) {
        return settingMapper.selectList(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, owner).likeRight(TkSetting::getSetKey, prefix)
                .orderByAsc(TkSetting::getUpdatedAt));
    }

    private Map<String, Set<LocalDate>> checkinDates(List<TkSetting> rows) {
        Map<String, Set<LocalDate>> result = new HashMap<>();
        for (TkSetting row : rows) {
            String rest = row.getSetKey().substring(CHECKIN_PREFIX.length());
            int split = rest.lastIndexOf('.');
            if (split < 1) continue;
            try {
                String id = rest.substring(0, split);
                LocalDate date = LocalDate.parse(rest.substring(split + 1));
                result.computeIfAbsent(id, ignored -> new LinkedHashSet<>()).add(date);
            } catch (RuntimeException ignored) {
                // 忽略损坏的历史打卡键，不影响整个成长页。
            }
        }
        return result;
    }

    private Map<String, Object> habitView(TkSetting row, Set<LocalDate> dates) {
        JsonNode node = parse(row.getSetValue());
        LocalDate today = LocalDate.now(ZONE);
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", habitId(row));
        view.put("name", node.path("name").asText("未命名习惯"));
        view.put("emoji", node.path("emoji").asText("✦"));
        view.put("color", node.path("color").asText("violet"));
        view.put("createdAt", node.path("createdAt").asText(row.getUpdatedAt() == null ? "" : row.getUpdatedAt().toString()));
        view.put("checkedToday", dates.contains(today));
        view.put("streak", currentStreak(dates, today));
        view.put("bestStreak", bestStreak(dates));
        view.put("totalCheckins", dates.size());
        return view;
    }

    static int currentStreak(Set<LocalDate> dates, LocalDate today) {
        LocalDate cursor = dates.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (dates.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    static int bestStreak(Set<LocalDate> dates) {
        if (dates.isEmpty()) return 0;
        List<LocalDate> sorted = dates.stream().sorted().toList();
        int best = 1;
        int current = 1;
        for (int i = 1; i < sorted.size(); i++) {
            if (sorted.get(i).equals(sorted.get(i - 1).plusDays(1))) current++;
            else current = 1;
            best = Math.max(best, current);
        }
        return best;
    }

    private static Map<String, Object> skill(String code, String name, String description, String glyph, String color, long xp) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("code", code);
        item.put("name", name);
        item.put("description", description);
        item.put("glyph", glyph);
        item.put("color", color);
        item.put("xp", xp);
        item.put("level", (int) (xp / 60) + 1);
        item.put("levelXp", (int) (xp % 60));
        item.put("nextLevelXp", 60);
        return item;
    }

    private static Map<String, Object> badge(String category, String code, String name, String description,
                                             String glyph, long current, long target) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("category", category);
        item.put("code", code);
        item.put("name", name);
        item.put("description", description);
        item.put("glyph", glyph);
        item.put("current", Math.min(current, target));
        item.put("target", target);
        item.put("unlocked", current >= target);
        item.put("rarity", target >= 100 ? "legendary" : target >= 30 ? "epic" : target >= 10 ? "rare" : "common");
        return item;
    }

    private static String titleFor(int level) {
        if (level >= 15) return "织境旅者";
        if (level >= 10) return "心智编织师";
        if (level >= 6) return "知识探索者";
        if (level >= 3) return "成长记录者";
        return "初醒的织梦人";
    }

    private TkSetting ownedHabit(String id) {
        if (id == null || !id.matches("[a-f0-9]{12}")) throw new BizException("习惯不存在");
        TkSetting row = settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, owner()).eq(TkSetting::getSetKey, HABIT_PREFIX + id));
        if (row == null) throw new BizException("习惯不存在");
        return row;
    }

    private String habitId(TkSetting row) {
        return row.getSetKey().substring(HABIT_PREFIX.length());
    }

    private String habitName(TkSetting row) {
        return parse(row.getSetValue()).path("name").asText("未命名习惯");
    }

    private void insertSetting(String owner, String key, String value) {
        TkSetting row = new TkSetting();
        row.setOwner(owner);
        row.setSetKey(key);
        row.setSetValue(value);
        row.setUpdatedAt(LocalDateTime.now(ZONE));
        settingMapper.insert(row);
    }

    private JsonNode parse(String json) {
        try {
            return objectMapper.readTree(json == null ? "{}" : json);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new BizException("习惯保存失败");
        }
    }

    private static String cleanEmoji(String emoji) {
        String value = emoji == null ? "✦" : emoji.trim();
        return value.isBlank() ? "✦" : value.substring(0, Math.min(value.length(), 4));
    }
}
