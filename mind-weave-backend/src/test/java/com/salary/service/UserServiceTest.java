package com.salary.service;

import com.salary.common.BizException;
import com.salary.dto.UserRequest;
import com.salary.entity.AppUser;
import com.salary.mapper.AppUserMapper;
import com.salary.mapper.UserPermissionMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock AppUserMapper userMapper;
    @Mock PasswordEncoder passwordEncoder;
    @Mock LogService logService;
    @Mock PermissionService permissionService;
    @Mock UserPermissionMapper userPermissionMapper;
    @InjectMocks UserService userService;

    @BeforeEach
    void loginAsAdmin() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", "", java.util.List.of()));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void currentAdministratorCannotDisableItself() {
        AppUser admin = user(1L, "admin", "ADMIN", 1);
        when(userMapper.selectById(1L)).thenReturn(admin);
        UserRequest request = validRequest("ADMIN", 0);

        BizException error = assertThrows(BizException.class, () -> userService.update(1L, request));

        assertEquals("不能禁用当前账号或取消自己的管理员角色", error.getMessage());
    }

    @Test
    void lastEnabledAdministratorCannotBeDowngraded() {
        AppUser admin = user(2L, "other-admin", "ADMIN", 1);
        when(userMapper.selectById(2L)).thenReturn(admin);
        when(userMapper.selectCount(org.mockito.ArgumentMatchers.any())).thenReturn(1L);
        UserRequest request = validRequest("USER", 1);

        BizException error = assertThrows(BizException.class, () -> userService.update(2L, request));

        assertEquals("至少保留一个启用的管理员账号", error.getMessage());
    }

    @Test
    void rejectsInvalidRoleBeforeCreatingUser() {
        UserRequest request = validRequest("SUPER_ADMIN", 1);

        BizException error = assertThrows(BizException.class, () -> userService.create(request));

        assertEquals("用户角色无效", error.getMessage());
    }

    @Test
    void resetPasswordRejectsShortPassword() {
        when(userMapper.selectById(3L)).thenReturn(user(3L, "member", "USER", 1));

        BizException error = assertThrows(BizException.class, () -> userService.resetPassword(3L, "123"));

        assertEquals("密码至少需要 6 位", error.getMessage());
    }

    private static UserRequest validRequest(String role, int enabled) {
        UserRequest request = new UserRequest();
        request.setUsername("member");
        request.setRole(role);
        request.setEnabled(enabled);
        request.setDataScope("ALL");
        return request;
    }

    private static AppUser user(Long id, String username, String role, int enabled) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setUsername(username);
        user.setRole(role);
        user.setEnabled(enabled);
        return user;
    }
}
