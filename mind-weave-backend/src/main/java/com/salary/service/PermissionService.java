package com.salary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.salary.common.BizException;
import com.salary.entity.AppUser;
import com.salary.entity.Permission;
import com.salary.entity.RolePermission;
import com.salary.entity.UserPermission;
import com.salary.mapper.AppUserMapper;
import com.salary.mapper.PermissionMapper;
import com.salary.mapper.RolePermissionMapper;
import com.salary.mapper.UserPermissionMapper;
import com.salary.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PermissionService {
    private final PermissionMapper permissionMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final UserPermissionMapper userPermissionMapper;
    private final AppUserMapper userMapper;

    /** 全部权限（供管理页展示） */
    public List<Permission> listAll() {
        return permissionMapper.selectList(new LambdaQueryWrapper<Permission>()
                .orderByAsc(Permission::getPgroup).orderByAsc(Permission::getCode));
    }

    /** 角色默认权限 */
    public List<String> rolePermissions(String role) {
        return rolePermissionMapper.selectList(new LambdaQueryWrapper<RolePermission>()
                        .eq(RolePermission::getRole, role)).stream()
                .map(RolePermission::getPermCode).toList();
    }

    /** 用户生效权限 = 角色权限 + 用户 ALLOW - 用户 DENY */
    public Set<String> permissionsOf(AppUser user) {
        Set<String> set = new LinkedHashSet<>(rolePermissions(user.getRole()));
        for (UserPermission up : userPermissionMapper.selectList(new LambdaQueryWrapper<UserPermission>()
                .eq(UserPermission::getUserId, user.getId()))) {
            if ("DENY".equals(up.getPermType())) set.remove(up.getPermCode());
            else set.add(up.getPermCode());
        }
        return set;
    }

    public List<String> currentPermissions() {
        AppUser u = currentUser();
        return new ArrayList<>(permissionsOf(u));
    }

    /** 用户显式覆盖：code -> ALLOW/DENY */
    public Map<String, String> userOverrides(Long userId) {
        Map<String, String> map = new java.util.LinkedHashMap<>();
        for (UserPermission up : userPermissionMapper.selectList(new LambdaQueryWrapper<UserPermission>()
                .eq(UserPermission::getUserId, userId))) {
            map.put(up.getPermCode(), up.getPermType());
        }
        return map;
    }

    public boolean can(String code) {
        return permissionsOf(currentUser()).contains(code);
    }

    public void require(String code) {
        if (!can(code)) throw new BizException("无权限执行该操作（" + code + "）");
    }

    /** 数据访问范围：null=全部，空列表=无，非空=仅这些级别 */
    public List<String> salaryScopeGrades() {
        AppUser u = currentUser();
        if (u.getDataScope() == null || "ALL".equals(u.getDataScope())) return null;
        if ("NONE".equals(u.getDataScope())) return List.of();
        List<String> grades = new ArrayList<>();
        if (u.getScopeGrades() != null) {
            for (String g : u.getScopeGrades().split(",")) {
                if (!g.isBlank()) grades.add(g.trim());
            }
        }
        return grades;
    }

    private AppUser currentUser() {
        AppUser u = userMapper.selectOne(new LambdaQueryWrapper<AppUser>()
                .eq(AppUser::getUsername, SecurityUtils.currentUsername()));
        return u == null ? new AppUser() : u;
    }

    /** 初始化权限与角色映射（幂等） */
    public void seed() {
        Map<String, String> perms = Map.ofEntries(
                Map.entry("home", "首页仪表盘"),
                Map.entry("dashboard", "仪表盘"),
                Map.entry("records", "工资记录"),
                Map.entry("records.view", "工资记录-查看"),
                Map.entry("records.create", "工资记录-新增"),
                Map.entry("records.edit", "工资记录-编辑"),
                Map.entry("records.delete", "工资记录-删除"),
                Map.entry("records.export", "工资记录-导出"),
                Map.entry("comments", "批注管理"),
                Map.entry("comments.create", "批注-新增"),
                Map.entry("comments.edit", "批注-编辑"),
                Map.entry("comments.delete", "批注-删除"),
                Map.entry("import", "数据导入"),
                Map.entry("import.execute", "数据导入-执行"),
                Map.entry("stats", "统计分析"),
                Map.entry("users", "用户管理"),
                Map.entry("users.manage", "用户管理-维护"),
                Map.entry("logs", "操作日志"),
                Map.entry("logs.view", "操作日志-查看"),
                Map.entry("apis", "API 管理"),
                Map.entry("apis.manage", "API 管理-维护"),
                Map.entry("vault", "我的保险箱"),
                Map.entry("vault.view", "保险箱-查看"),
                Map.entry("vault.create", "保险箱-新增"),
                Map.entry("vault.edit", "保险箱-编辑"),
                Map.entry("vault.delete", "保险箱-删除"),
                Map.entry("articles", "知识库"),
                Map.entry("article.view", "知识库-查看"),
                Map.entry("article.create", "知识库-新增"),
                Map.entry("article.edit", "知识库-编辑"),
                Map.entry("article.delete", "知识库-删除"),
                Map.entry("todos", "日程待办"),
                Map.entry("todo.create", "待办-新增"),
                Map.entry("todo.edit", "待办-编辑"),
                Map.entry("todo.delete", "待办-删除"),
                Map.entry("settings", "系统设置"),
                Map.entry("settings.manage", "系统设置-维护"),
                Map.entry("community", "互动管理"),
                Map.entry("community.manage", "互动内容-审核与房间管理"));
        List<String> admin = new ArrayList<>(perms.keySet());
        List<String> manager = List.of("dashboard", "records", "records.view", "records.create",
                "records.edit", "records.delete", "records.export", "comments", "comments.create",
                "comments.edit", "comments.delete", "import", "import.execute", "stats", "vault",
                "vault.view", "vault.create", "vault.edit", "vault.delete", "articles", "article.view",
                "article.create", "article.edit", "article.delete", "todos", "todo.create",
                "todo.edit", "todo.delete");
        List<String> user = List.of("dashboard", "records", "records.view", "comments", "stats",
                "vault", "vault.view", "vault.create", "vault.edit", "vault.delete", "articles",
                "article.view", "article.create", "article.edit", "article.delete", "todos",
                "todo.create", "todo.edit", "todo.delete");
        for (Map.Entry<String, String> e : perms.entrySet()) {
            if (permissionMapper.selectCount(new LambdaQueryWrapper<Permission>()
                    .eq(Permission::getCode, e.getKey())) == 0) {
                Permission p = new Permission();
                p.setCode(e.getKey());
                p.setName(e.getValue());
                p.setPgroup(e.getKey().contains(".") ? "操作权限" : "菜单权限");
                permissionMapper.insert(p);
            }
        }
        List<String> homeIncludedManager = new ArrayList<>(manager);
        homeIncludedManager.add(0, "home");
        List<String> homeIncludedUser = new ArrayList<>(user);
        homeIncludedUser.add(0, "home");
        seedRole("ADMIN", admin);
        seedRole("MANAGER", homeIncludedManager);
        seedRole("USER", homeIncludedUser);
    }

    private void seedRole(String role, List<String> codes) {
        for (String code : codes) {
            if (rolePermissionMapper.selectCount(new LambdaQueryWrapper<RolePermission>()
                    .eq(RolePermission::getRole, role).eq(RolePermission::getPermCode, code)) == 0) {
                RolePermission rp = new RolePermission();
                rp.setRole(role);
                rp.setPermCode(code);
                rolePermissionMapper.insert(rp);
            }
        }
    }
}
