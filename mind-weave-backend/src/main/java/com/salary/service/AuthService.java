package com.salary.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.salary.common.BizException;
import com.salary.dto.LoginRequest;
import com.salary.dto.LoginResponse;
import com.salary.dto.WxLoginResponse;
import com.salary.dto.PasswordRequest;
import com.salary.dto.UserInfo;
import com.salary.entity.AppUser;
import com.salary.mapper.AppUserMapper;
import com.salary.security.JwtUtil;
import com.salary.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final AppUserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LogService logService;
    private final PermissionService permissionService;
    private final WxClient wxClient;

    public LoginResponse login(LoginRequest req) {
        AppUser user = userMapper.selectOne(new LambdaQueryWrapper<AppUser>()
                .eq(AppUser::getUsername, req.getUsername()));
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new BizException("用户名或密码错误");
        }
        if (user.getEnabled() == null || user.getEnabled() != 1) {
            throw new BizException("账号已被禁用");
        }
        String token = jwtUtil.generate(user.getUsername(), user.getRole());
        logService.record(user.getUsername(), "LOGIN", "USER", user.getId(), "登录成功");
        return new LoginResponse(token, toInfo(user, permissionService.permissionsOf(user),
                permissionService.userOverrides(user.getId())));
    }

    public UserInfo me() {
        String username = SecurityUtils.currentUsername();
        AppUser user = userMapper.selectOne(new LambdaQueryWrapper<AppUser>()
                .eq(AppUser::getUsername, username));
        if (user == null) {
            throw new BizException("用户不存在");
        }
        return toInfo(user, permissionService.permissionsOf(user), permissionService.userOverrides(user.getId()));
    }

    /** 微信无感登录：code 换 openid，已绑定则直接登录，未绑定返回 needBind */
    public WxLoginResponse wxLogin(String code) {
        String openid = wxClient.code2session(code);
        AppUser user = userMapper.selectOne(new LambdaQueryWrapper<AppUser>()
                .eq(AppUser::getOpenid, openid));
        if (user == null) {
            return new WxLoginResponse(null, null, true);
        }
        if (user.getEnabled() == null || user.getEnabled() != 1) {
            throw new BizException("账号已被禁用");
        }
        String token = jwtUtil.generate(user.getUsername(), user.getRole());
        logService.record(user.getUsername(), "WX_LOGIN", "USER", user.getId(), "微信无感登录");
        return new WxLoginResponse(token,
                toInfo(user, permissionService.permissionsOf(user), permissionService.userOverrides(user.getId())),
                false);
    }

    /** 微信绑定：用账号密码绑定 openid，绑定后返回登录态 */
    public WxLoginResponse wxBind(String code, String username, String password) {
        String openid = wxClient.code2session(code);
        AppUser user = userMapper.selectOne(new LambdaQueryWrapper<AppUser>()
                .eq(AppUser::getUsername, username));
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BizException("用户名或密码错误");
        }
        if (user.getEnabled() == null || user.getEnabled() != 1) {
            throw new BizException("账号已被禁用");
        }
        if (user.getOpenid() != null && !user.getOpenid().isEmpty() && !user.getOpenid().equals(openid)) {
            throw new BizException("该账号已绑定其他微信账号");
        }
        user.setOpenid(openid);
        userMapper.updateById(user);
        String token = jwtUtil.generate(user.getUsername(), user.getRole());
        logService.record(user.getUsername(), "WX_BIND", "USER", user.getId(), "微信绑定登录");
        return new WxLoginResponse(token,
                toInfo(user, permissionService.permissionsOf(user), permissionService.userOverrides(user.getId())),
                false);
    }

    @Transactional
    public void changePassword(PasswordRequest req) {
        String username = SecurityUtils.currentUsername();
        AppUser user = userMapper.selectOne(new LambdaQueryWrapper<AppUser>()
                .eq(AppUser::getUsername, username));
        if (user == null || !passwordEncoder.matches(req.getOldPassword(), user.getPasswordHash())) {
            throw new BizException("原密码错误");
        }
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        userMapper.updateById(user);
        logService.record(username, "CHANGE_PASSWORD", "USER", user.getId(), "修改密码");
    }

    public void seedAdminIfEmpty() {
        Long count = userMapper.selectCount(null);
        if (count != null && count == 0) {
            AppUser admin = new AppUser();
            admin.setUsername("admin");
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            admin.setDisplayName("系统管理员");
            admin.setRole("ADMIN");
            admin.setEnabled(1);
            admin.setCreatedAt(LocalDateTime.now());
            userMapper.insert(admin);
            logService.record("system", "INIT", "USER", admin.getId(), "初始化管理员账号 admin");
        }
    }

    public static UserInfo toInfo(AppUser user) {
        return toInfo(user, null, null);
    }

    public static UserInfo toInfo(AppUser user, Set<String> permissions, Map<String, String> overrides) {
        UserInfo info = new UserInfo(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getRole(), user.getEnabled(), user.getDataScope(), user.getScopeGrades(),
                permissions == null ? null : new java.util.ArrayList<>(permissions),
                null, null);
        if (overrides != null) {
            List<String> allow = new java.util.ArrayList<>();
            List<String> deny = new java.util.ArrayList<>();
            overrides.forEach((code, type) -> {
                if ("DENY".equals(type)) deny.add(code);
                else allow.add(code);
            });
            info.setAllowOverrides(allow);
            info.setDenyCodes(deny);
        }
        return info;
    }
}
