package com.salary.common;

import org.junit.jupiter.api.Test;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * 客户端中途断开时必须安静收场。
 *
 * <p>回归背景：会客厅用 SSE 长连接，用户关掉页面就会触发
 * AsyncRequestNotUsableException。若它落到兜底处理器，会往
 * text/event-stream 响应里写 JSON 而再次抛错，把一次正常断开变成一串级联报错。
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void asyncRequestNotUsableIsHandledSilently() {
        assertDoesNotThrow(() -> handler.clientDisconnected(
                new AsyncRequestNotUsableException("ServletOutputStream failed to flush")));
    }

    @Test
    void clientAbortIsHandledSilently() {
        assertDoesNotThrow(() -> handler.clientDisconnected(
                new org.apache.catalina.connector.ClientAbortException(new IOException("连接被中止"))));
    }
}
