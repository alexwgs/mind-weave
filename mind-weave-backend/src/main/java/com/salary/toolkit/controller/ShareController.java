package com.salary.toolkit.controller;

import com.salary.common.Result;
import com.salary.toolkit.dto.ShareAccessReq;
import com.salary.toolkit.dto.ShareAccessVO;
import com.salary.toolkit.service.ArticleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tool/share")
@RequiredArgsConstructor
public class ShareController {
    private final ArticleService articleService;

    @GetMapping("/{token}")
    public Result<ShareAccessVO> access(@PathVariable String token,
                                        @RequestParam(required = false) String password) {
        return Result.ok(articleService.accessShare(token, password));
    }

    @PostMapping("/{token}")
    public Result<ShareAccessVO> accessPost(@PathVariable String token,
                                            @RequestBody(required = false) ShareAccessReq req) {
        return Result.ok(articleService.accessShare(token, req == null ? null : req.getPassword()));
    }
}
