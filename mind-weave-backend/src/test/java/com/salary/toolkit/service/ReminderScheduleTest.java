package com.salary.toolkit.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ReminderScheduleTest {
    @Test
    void normalizesLegacyWholeHourRules() {
        assertEquals("0 0 0 * * *", ReminderSchedule.normalize("DAILY:00"));
        assertEquals("0 0 9 * * MON,WED", ReminderSchedule.normalize("WEEKLY:MON,WED:09"));
        assertEquals("0 0 8 1,15 * *", ReminderSchedule.normalize("MONTHLY:1,15:08"));
    }

    @Test
    void findsLatestMissedOccurrenceInsideCatchUpWindow() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 18, 10, 30);
        assertEquals(LocalDateTime.of(2026, 9, 18, 9, 0),
                ReminderSchedule.latestDue("0 0 9 * * ?", null, now.minusDays(2), now));
    }

    @Test
    void doesNotReplayOccurrencesBeforeCreationOrCursor() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 18, 10, 30);
        assertNull(ReminderSchedule.latestDue("0 0 9 * * ?", now, now.minusDays(2), now));
        assertNull(ReminderSchedule.latestDue("0 0 9 * * ?", null, now.minusMinutes(10), now));
    }

    @Test
    void returnsNextOccurrenceForStatusDisplay() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 18, 10, 30);
        assertEquals(LocalDateTime.of(2026, 9, 19, 9, 0), ReminderSchedule.nextDue("0 0 9 * * ?", now));
        assertNull(ReminderSchedule.nextDue(null, now));
    }
}
