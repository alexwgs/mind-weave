package com.salary.toolkit.controller;

import com.salary.common.Result;
import com.salary.toolkit.dto.RpgHabitReq;
import com.salary.toolkit.service.RpgService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/tool/rpg")
@RequiredArgsConstructor
public class RpgController {
    private final RpgService rpgService;

    @GetMapping
    public Result<Map<String, Object>> overview() {
        return Result.ok(rpgService.overview());
    }

    @PostMapping("/habits")
    public Result<Map<String, Object>> createHabit(@RequestBody RpgHabitReq req) {
        return Result.ok(rpgService.createHabit(req));
    }

    @PostMapping("/habits/{id}/toggle")
    public Result<Map<String, Object>> toggleToday(@PathVariable String id) {
        return Result.ok(rpgService.toggleToday(id));
    }

    @DeleteMapping("/habits/{id}")
    public Result<Map<String, Object>> deleteHabit(@PathVariable String id) {
        return Result.ok(rpgService.deleteHabit(id));
    }
}
