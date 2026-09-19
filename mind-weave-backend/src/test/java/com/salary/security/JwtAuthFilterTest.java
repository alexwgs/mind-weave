package com.salary.security;

import io.jsonwebtoken.MalformedJwtException;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtAuthFilterTest {
    @Test
    void expiredTokenFallsBackToGuestForPublicCommunityApi() throws Exception {
        JwtUtil jwt = mock(JwtUtil.class);
        when(jwt.parse("expired")).thenThrow(new MalformedJwtException("expired"));
        JwtAuthFilter filter = new JwtAuthFilter(jwt);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/community/public/guestbook");
        request.addHeader("Authorization", "Bearer expired");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean();
        FilterChain chain = (req, res) -> called.set(true);

        filter.doFilter(request, response, chain);

        assertTrue(called.get());
        assertEquals(200, response.getStatus());
    }

    @Test
    void expiredTokenStillReturnsUnauthorizedForProtectedApi() throws Exception {
        JwtUtil jwt = mock(JwtUtil.class);
        when(jwt.parse("expired")).thenThrow(new MalformedJwtException("expired"));
        JwtAuthFilter filter = new JwtAuthFilter(jwt);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/community/admin/rooms");
        request.addHeader("Authorization", "Bearer expired");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean();

        filter.doFilter(request, response, (req, res) -> called.set(true));

        assertFalse(called.get());
        assertEquals(401, response.getStatus());
    }
}
