package com.salary.controller;

import com.salary.common.Result;
import com.salary.dto.AnnualStat;
import com.salary.dto.MonthlyPoint;
import com.salary.dto.StatsOverview;
import com.salary.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {
    private final StatsService statsService;

    @GetMapping("/overview")
    public Result<StatsOverview> overview(@RequestParam(required = false) Integer yearFrom,
                                          @RequestParam(required = false) Integer yearTo) {
        return Result.ok(statsService.overview(yearFrom, yearTo));
    }

    @GetMapping("/annual")
    public Result<List<AnnualStat>> annual(@RequestParam(required = false) Integer yearFrom,
                                           @RequestParam(required = false) Integer yearTo) {
        return Result.ok(statsService.annual(yearFrom, yearTo));
    }

    @GetMapping("/trend")
    public Result<List<MonthlyPoint>> trend(@RequestParam(required = false) Integer yearFrom,
                                            @RequestParam(required = false) Integer yearTo) {
        return Result.ok(statsService.monthlyTrend(yearFrom, yearTo));
    }
}
