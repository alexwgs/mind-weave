package com.salary.toolkit.task;

import com.salary.toolkit.entity.Todo;
import com.salary.toolkit.mapper.TkSettingMapper;
import com.salary.toolkit.mapper.TodoMapper;
import com.salary.toolkit.service.BarkClient;
import com.salary.toolkit.service.ReminderSchedule;
import com.salary.weixin.WxSubscribeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TodoSchedulerTest {
    @Mock TodoMapper todoMapper;
    @Mock TkSettingMapper settingMapper;
    @Mock BarkClient barkClient;
    @Mock WxSubscribeService wxSubscribeService;

    private TodoScheduler scheduler;
    private final LocalDateTime now = LocalDateTime.of(2026, 9, 18, 10, 0);

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-18T02:00:00Z"), ReminderSchedule.ZONE);
        scheduler = new TodoScheduler(todoMapper, settingMapper, barkClient, wxSubscribeService, clock);
        when(wxSubscribeService.sendReminder(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString())).thenReturn(WxSubscribeService.SendResult.FAILED);
    }

    @Test
    void oneOffReminderUsesReminderTimeInsteadOfLaterDueTime() {
        Todo todo = todo("写周报");
        todo.setRemindTime(now.minusMinutes(10));
        todo.setDueTime(now.plusHours(8));

        scheduler.remind(todo, null, now);

        verify(wxSubscribeService).sendReminder("alice", "待办提醒", "2026-09-18 09:50", "写周报");
    }

    @Test
    void recurringTodoCanAlsoSendItsOneOffReminder() {
        Todo todo = todo("晨间复盘");
        todo.setRemindTime(now.minusMinutes(5));
        todo.setDueTime(now.plusHours(1));
        todo.setRecurRule("0 0 9 * * ?");
        todo.setRecurLastFired(now);

        scheduler.remind(todo, null, now);

        verify(wxSubscribeService).sendReminder("alice", "待办提醒", "2026-09-18 09:55", "晨间复盘");
    }

    private Todo todo(String title) {
        Todo todo = new Todo();
        todo.setId(1L);
        todo.setOwner("alice");
        todo.setTitle(title);
        todo.setDone(0);
        todo.setRemindSent(0);
        todo.setOverdueSent(0);
        todo.setCreatedAt(now.minusDays(1));
        todo.setUpdatedAt(now.minusHours(1));
        return todo;
    }
}
