package com.salary.admin;

import com.salary.common.BizException;
import com.salary.toolkit.entity.TkSetting;
import com.salary.toolkit.mapper.TkSettingMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ApiToggleServiceTest {
    @Test
    void matchesDisabledPathTemplatesButNotOtherMethods() {
        TkSetting row = new TkSetting();
        row.setSetValue("GET /api/tool/todos/{id}");
        TkSettingMapper mapper = mock(TkSettingMapper.class);
        when(mapper.selectList(any())).thenReturn(List.of(row));
        ApiToggleService service = new ApiToggleService(mapper);

        assertTrue(service.isRequestDisabled("GET", "/api/tool/todos/42"));
        assertFalse(service.isRequestDisabled("POST", "/api/tool/todos/42"));
    }

    @Test
    void neverBlocksOrDisablesProtectedEndpoints() {
        TkSettingMapper mapper = mock(TkSettingMapper.class);
        ApiToggleService service = new ApiToggleService(mapper);

        assertFalse(service.isRequestDisabled("POST", "/api/auth/login"));
        assertFalse(service.isRequestDisabled("GET", "/api/admin/apis"));
        assertThrows(BizException.class, () -> service.setEnabled("GET", "/api/admin/apis", false));
    }
}
