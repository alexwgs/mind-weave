package com.salary.toolkit.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RpgServiceTest {
    private final LocalDate today = LocalDate.of(2026, 9, 18);

    @Test
    void currentStreakAllowsTodayToRemainUnchecked() {
        Set<LocalDate> dates = Set.of(today.minusDays(1), today.minusDays(2), today.minusDays(3));
        assertEquals(3, RpgService.currentStreak(dates, today));
    }

    @Test
    void currentStreakIncludesTodayAndStopsAtAGap() {
        Set<LocalDate> dates = Set.of(today, today.minusDays(1), today.minusDays(3));
        assertEquals(2, RpgService.currentStreak(dates, today));
    }

    @Test
    void bestStreakFindsTheLongestHistoricalRun() {
        Set<LocalDate> dates = Set.of(
                today.minusDays(9), today.minusDays(8),
                today.minusDays(4), today.minusDays(3), today.minusDays(2), today.minusDays(1));
        assertEquals(4, RpgService.bestStreak(dates));
        assertEquals(0, RpgService.bestStreak(Set.of()));
    }
}
