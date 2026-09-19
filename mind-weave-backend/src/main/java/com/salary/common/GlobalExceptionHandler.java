package com.salary.common;

import lombok.extern.slf4j.Slf4j;
import org.apache.catalina.connector.ClientAbortException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BizException.class)
    public Result<Void> biz(BizException e) {
        return Result.fail(e.getMessage());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public Result<Void> valid(Exception e) {
        String msg = "参数校验失败";
        if (e instanceof MethodArgumentNotValidException m) {
            if (m.getBindingResult().getFieldError() != null) {
                msg = m.getBindingResult().getFieldError().getDefaultMessage();
            }
        }
        return Result.fail(msg);
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public Result<Void> denied(AccessDeniedException e) {
        return Result.fail("没有权限执行该操作");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public Result<Void> typeMismatch(MethodArgumentTypeMismatchException e) {
        return Result.fail("参数格式不正确：" + e.getName() + "=" + e.getValue());
    }

    /**
     * 客户端中途断开（会客厅 SSE 长连接最常见）。
     *
     * <p>这类异常必须单独处理：响应已经是 {@code text/event-stream}，再让下面的
     * 兜底处理器返回 JSON 会抛 HttpMessageNotWritableException，把一个正常的
     * "用户关掉页面"放大成一串级联报错。这里直接静默结束。
     */
    @ExceptionHandler({AsyncRequestNotUsableException.class, ClientAbortException.class})
    public void clientDisconnected(Exception e) {
        log.debug("客户端已断开连接：{}", e.getClass().getSimpleName());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Void> other(Exception e) {
        log.error("Unhandled exception", e);
        return Result.fail("系统异常: " + e.getMessage());
    }
}
