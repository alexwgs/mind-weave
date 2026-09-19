package com.salary.toolkit.service;

import org.springframework.scheduling.support.CronExpression;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Locale;

/** Shared parsing for API validation and the scheduler; all todo times are Shanghai local times. */
public final class ReminderSchedule {
    public static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    public static final int CATCH_UP_HOURS = 24;

    private ReminderSchedule() { }

    public static String normalize(String rule) {
        if (rule == null || rule.isBlank()) return null;
        String value = rule.trim();
        String[] parts = value.split(":");
        String kind = parts[0].toUpperCase(Locale.ROOT);
        if ("DAILY".equals(kind) && parts.length == 2) {
            // Early clients stored whole-hour rules as DAILY:09.
            value = "0 0 " + Integer.parseInt(parts[1]) + " * * *";
        } else if ("DAILY".equals(kind) && parts.length == 3) {
            value = "0 " + parts[2] + " " + parts[1] + " * * *";
        } else if ("WEEKLY".equals(kind) && parts.length == 3) {
            value = "0 0 " + Integer.parseInt(parts[2]) + " * * " + parts[1].toUpperCase(Locale.ROOT);
        } else if ("WEEKLY".equals(kind) && parts.length == 4) {
            value = "0 " + parts[3] + " " + parts[2] + " * * " + parts[1].toUpperCase(Locale.ROOT);
        } else if ("MONTHLY".equals(kind) && parts.length == 3) {
            value = "0 0 " + Integer.parseInt(parts[2]) + " " + parts[1] + " * *";
        } else if ("MONTHLY".equals(kind) && parts.length == 4) {
            value = "0 " + parts[3] + " " + parts[2] + " " + parts[1] + " * *";
        }
        return CronExpression.parse(value).toString();
    }

    /** Latest occurrence after the saved cursor, bounded to a day. Missed repetitions are coalesced. */
    public static LocalDateTime latestDue(String rule, LocalDateTime lastFired,
                                         LocalDateTime createdAt, LocalDateTime now) {
        CronExpression cron = CronExpression.parse(normalize(rule));
        LocalDateTime from = now.minusHours(CATCH_UP_HOURS);
        if (createdAt != null && createdAt.isAfter(from)) from = createdAt;
        if (lastFired != null && lastFired.isAfter(from)) from = lastFired;
        if (!from.isBefore(now)) return null;

        // Frequent expressions normally find their latest occurrence in the last minute.
        LocalDateTime recent = now.minusMinutes(1);
        if (recent.isAfter(from)) {
            LocalDateTime candidate = latestBetween(cron, recent, now);
            if (candidate != null) return candidate;
        }
        return latestBetween(cron, from, now);
    }

    public static LocalDateTime nextDue(String rule, LocalDateTime after) {
        if (rule == null || rule.isBlank() || after == null) return null;
        return CronExpression.parse(normalize(rule)).next(after);
    }

    private static LocalDateTime latestBetween(CronExpression cron, LocalDateTime from, LocalDateTime now) {
        LocalDateTime result = null;
        LocalDateTime next = cron.next(from);
        // Cron has second precision, so even an every-second rule is bounded within a 24-hour window.
        for (int i = 0; next != null && !next.isAfter(now) && i <= 86_400; i++) {
            result = next;
            next = cron.next(next);
        }
        return result;
    }
}
