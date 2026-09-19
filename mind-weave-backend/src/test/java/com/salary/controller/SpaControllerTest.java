package com.salary.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SpaControllerTest {
    private final SpaController controller = new SpaController();

    @Test
    void apiManagerWebRouteIsForwardedToSpa() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/apis");
        assertEquals("forward:/index.html", controller.forward(request));
    }

    @Test
    void backendApiRoutesAreNotForwardedToSpa() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/admin/apis");
        assertEquals("forward:/error", controller.forward(request));
    }
}
