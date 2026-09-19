package com.salary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.salary.common.BizException;
import com.salary.dto.UserInfo;
import com.salary.dto.UserRequest;
import com.salary.entity.AppUser;
import com.salary.mapper.AppUserMapper;
import com.salary.mapper.UserPermissionMapper;
import com.salary.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserService {
    private final AppUserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final LogService logService;
    private final PermissionService permissionService;
    private final UserPermissionMapper userPermissionMapper;

    public List<UserInfo> list() {
        List<UserInfo> out = new java.util.ArrayList<>();
        for (AppUser u : userMapper.selectList(new LambdaQueryWrapper<AppUser>()
                .orderByAsc(AppUser::getId))) {
            out.add(AuthService.toInfo(u, permissionService.permissionsOf(u),
                    permissionService.userOverrides(u.getId())));
        }
        return out;
    }

    @Transactional
    public UserInfo create(UserRequest req) {
        normalizeAndValidate(req, true);
        boolean usernameExists = userMapper.selectList(new LambdaQueryWrapper<AppUser>()
                        .select(AppUser::getUsername)).stream()
                .anyMatch(user -> user.getUsername().equalsIgnoreCase(req.getUsername()));
        if (usernameExists) {
            throw new BizException("用户名已存在");
        }
        AppUser u = new AppUser();
        u.setUsername(req.getUsername());
        u.setPasswordHash(passwordEncoder.encode(req.getPassword() == null || req.getPassword().isBlank()
                ? "123456" : req.getPassword()));
        u.setDisplayName(req.getDisplayName());
        u.setRole(req.getRole());
        u.setEnabled(req.getEnabled() == null ? 1 : req.getEnabled());
        u.setDataScope(req.getDataScope() == null ? "ALL" : req.getDataScope());
        u.setScopeGrades(req.getScopeGrades());
        u.setCreatedAt(LocalDateTime.now());
        userMapper.insert(u);
        savePermOverrides(u.getId(), req.getPermissionOverrides());
        logService.record(SecurityUtils.currentUsername(), "CREATE_USER", "USER", u.getId(),
                "创建用户 " + u.getUsername() + " 角色 " + u.getRole());
        return AuthService.toInfo(u, permissionService.permissionsOf(u), permissionService.userOverrides(u.getId()));
    }

    @Transactional
    public UserInfo update(Long id, UserRequest req) {
        AppUser u = userMapper.selectById(id);
        if (u == null) throw new BizException("用户不存在");
        normalizeAndValidate(req, false);
        boolean removesAdminAccess = "ADMIN".equals(u.getRole()) && isEnabled(u)
                && (!"ADMIN".equals(req.getRole()) || !Integer.valueOf(1).equals(req.getEnabled()));
        if (u.getUsername().equals(SecurityUtils.currentUsername()) && removesAdminAccess) {
            throw new BizException("不能禁用当前账号或取消自己的管理员角色");
        }
        if (removesAdminAccess && enabledAdminCount() <= 1) {
            throw new BizException("至少保留一个启用的管理员账号");
        }
        u.setDisplayName(req.getDisplayName());
        u.setRole(req.getRole());
        u.setEnabled(req.getEnabled() == null ? 1 : req.getEnabled());
        if (req.getDataScope() != null) u.setDataScope(req.getDataScope());
        u.setScopeGrades(req.getScopeGrades());
        userMapper.updateById(u);
        if (req.getPermissionOverrides() != null) savePermOverrides(id, req.getPermissionOverrides());
        logService.record(SecurityUtils.currentUsername(), "UPDATE_USER", "USER", id,
                "更新用户 " + u.getUsername());
        return AuthService.toInfo(u, permissionService.permissionsOf(u), permissionService.userOverrides(u.getId()));
    }

    @Transactional
    public void resetPassword(Long id, String newPassword) {
        AppUser u = userMapper.selectById(id);
        if (u == null) throw new BizException("用户不存在");
        String normalized = newPassword == null || newPassword.isBlank() ? "123456" : newPassword;
        if (normalized.length() < 6) throw new BizException("密码至少需要 6 位");
        u.setPasswordHash(passwordEncoder.encode(normalized));
        userMapper.updateById(u);
        logService.record(SecurityUtils.currentUsername(), "RESET_PASSWORD", "USER", id,
                "重置用户 " + u.getUsername() + " 密码");
    }

    @Transactional
    public void delete(Long id) {
        AppUser u = userMapper.selectById(id);
        if (u == null) throw new BizException("用户不存在");
        String me = SecurityUtils.currentUsername();
        if (u.getUsername().equals(me)) {
            throw new BizException("不能删除当前登录账号");
        }
        if ("ADMIN".equals(u.getRole()) && isEnabled(u) && enabledAdminCount() <= 1) {
            throw new BizException("至少保留一个启用的管理员账号");
        }
        userMapper.deleteById(id);
        userPermissionMapper.delete(new LambdaQueryWrapper<com.salary.entity.UserPermission>()
                .eq(com.salary.entity.UserPermission::getUserId, id));
        logService.record(me, "DELETE_USER", "USER", id, "删除用户 " + u.getUsername());
    }

    private void savePermOverrides(Long userId, List<com.salary.dto.UserPermReq> overrides) {
        userPermissionMapper.delete(new LambdaQueryWrapper<com.salary.entity.UserPermission>()
                .eq(com.salary.entity.UserPermission::getUserId, userId));
        if (overrides == null) return;
        for (com.salary.dto.UserPermReq o : overrides) {
            if (o.getCode() == null || o.getType() == null) continue;
            com.salary.entity.UserPermission up = new com.salary.entity.UserPermission();
            up.setUserId(userId);
            up.setPermCode(o.getCode());
            up.setPermType(o.getType());
            userPermissionMapper.insert(up);
        }
    }

    private void normalizeAndValidate(UserRequest req, boolean creating) {
        req.setUsername(req.getUsername() == null ? null : req.getUsername().trim());
        req.setDisplayName(req.getDisplayName() == null ? null : req.getDisplayName().trim());
        req.setScopeGrades(normalizeGrades(req.getScopeGrades()));
        if (req.getUsername() == null || !req.getUsername().matches("[A-Za-z0-9_.-]{3,32}")) {
            throw new BizException("用户名须为 3-32 位字母、数字、点、横线或下划线");
        }
        if (!Set.of("ADMIN", "MANAGER", "USER").contains(req.getRole())) {
            throw new BizException("用户角色无效");
        }
        if (req.getEnabled() == null) req.setEnabled(1);
        if (!Set.of(0, 1).contains(req.getEnabled())) throw new BizException("用户状态无效");
        if (req.getDataScope() == null) req.setDataScope("ALL");
        if (!Set.of("ALL", "GRADES", "NONE").contains(req.getDataScope())) {
            throw new BizException("数据访问范围无效");
        }
        if ("GRADES".equals(req.getDataScope()) && (req.getScopeGrades() == null || req.getScopeGrades().isBlank())) {
            throw new BizException("指定级别模式下至少填写一个级别");
        }
        if (creating && req.getPassword() != null && !req.getPassword().isBlank() && req.getPassword().length() < 6) {
            throw new BizException("密码至少需要 6 位");
        }
        validateOverrides(req.getPermissionOverrides());
    }

    private void validateOverrides(List<com.salary.dto.UserPermReq> overrides) {
        if (overrides == null) return;
        Set<String> knownCodes = new HashSet<>();
        permissionService.listAll().forEach(permission -> knownCodes.add(permission.getCode()));
        Set<String> seen = new HashSet<>();
        for (com.salary.dto.UserPermReq override : overrides) {
            if (override == null || !knownCodes.contains(override.getCode())) throw new BizException("包含无效的权限项");
            if (!Set.of("ALLOW", "DENY").contains(override.getType())) throw new BizException("权限覆盖类型无效");
            if (!seen.add(override.getCode())) throw new BizException("权限项不能重复");
        }
    }

    private long enabledAdminCount() {
        Long count = userMapper.selectCount(new LambdaQueryWrapper<AppUser>()
                .eq(AppUser::getRole, "ADMIN").eq(AppUser::getEnabled, 1));
        return count == null ? 0 : count;
    }

    private static boolean isEnabled(AppUser user) {
        return Integer.valueOf(1).equals(user.getEnabled());
    }

    private static String normalizeGrades(String value) {
        if (value == null || value.isBlank()) return null;
        return String.join(",", java.util.Arrays.stream(value.split("[,，]"))
                .map(String::trim).filter(part -> !part.isBlank()).distinct().toList());
    }
}
