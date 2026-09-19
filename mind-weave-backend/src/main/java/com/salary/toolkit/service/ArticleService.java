package com.salary.toolkit.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.BizException;
import com.salary.security.SecurityUtils;
import com.salary.toolkit.dto.ArticleReq;
import com.salary.toolkit.dto.ShareAccessVO;
import com.salary.toolkit.dto.ShareReq;
import com.salary.toolkit.entity.ArticleCategory;
import com.salary.toolkit.entity.TkArticle;
import com.salary.toolkit.mapper.ArticleCategoryMapper;
import com.salary.toolkit.mapper.TkArticleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ArticleService {
    private final TkArticleMapper articleMapper;
    private final ArticleCategoryMapper categoryMapper;
    private final PasswordEncoder passwordEncoder;
    private final com.salary.service.PermissionService permissionService;
    private final com.salary.service.LogService logService;

    private String owner() {
        return SecurityUtils.currentUsername();
    }

    // ---------------- 分类 ----------------
    public List<ArticleCategory> listCategories() {
        permissionService.require("article.view");
        return categoryMapper.selectList(new LambdaQueryWrapper<ArticleCategory>()
                .eq(ArticleCategory::getOwner, owner())
                .orderByAsc(ArticleCategory::getSortOrder)
                .orderByAsc(ArticleCategory::getId));
    }

    public ArticleCategory createCategory(String name, Long parentId, Integer sortOrder) {
        permissionService.require("article.edit");
        if (name == null || name.isBlank()) throw new BizException("分类名称必填");
        ArticleCategory c = new ArticleCategory();
        c.setOwner(owner());
        c.setParentId(parentId);
        c.setName(name.trim());
        c.setSortOrder(sortOrder == null ? 0 : sortOrder);
        c.setPath(computePath(parentId, name.trim()));
        c.setCreatedAt(LocalDateTime.now());
        c.setUpdatedAt(LocalDateTime.now());
        categoryMapper.insert(c);
        logService.record(owner(), "CREATE_ARTICLE_CATEGORY", "ARTICLE_CATEGORY", c.getId(), "新建分类 " + c.getName());
        return c;
    }

    @Transactional
    public ArticleCategory updateCategory(Long id, String name, Long parentId, Integer sortOrder) {
        permissionService.require("article.edit");
        ArticleCategory c = ownedCategory(id);
        if (name != null && !name.isBlank()) {
            c.setName(name.trim());
            c.setPath(computePath(parentId == null ? c.getParentId() : parentId, name.trim()));
        }
        if (parentId != null) c.setParentId(parentId);
        if (sortOrder != null) c.setSortOrder(sortOrder);
        c.setUpdatedAt(LocalDateTime.now());
        categoryMapper.updateById(c);
        logService.record(owner(), "UPDATE_ARTICLE_CATEGORY", "ARTICLE_CATEGORY", c.getId(), "修改分类 " + c.getName());
        return c;
    }

    public void deleteCategory(Long id) {
        permissionService.require("article.edit");
        ownedCategory(id);
        categoryMapper.deleteById(id); // 子分类由外键级联删除，文章分类置空
        logService.record(owner(), "DELETE_ARTICLE_CATEGORY", "ARTICLE_CATEGORY", id, "删除分类");
    }

    private String computePath(Long parentId, String name) {
        if (parentId == null) return "/" + name;
        ArticleCategory p = categoryMapper.selectById(parentId);
        String base = (p != null && p.getPath() != null) ? p.getPath() : "";
        return base + "/" + name;
    }

    // ---------------- 文章 ----------------
    public Page<TkArticle> page(int page, int size, String status, Long categoryId, String tag, String keyword,
                                String sortField, String sortOrder) {
        permissionService.require("article.view");
        LambdaQueryWrapper<TkArticle> qw = new LambdaQueryWrapper<TkArticle>()
                .eq(TkArticle::getOwner, owner());
        if (status != null && !status.isBlank()) qw.eq(TkArticle::getStatus, status);
        if (categoryId != null) qw.eq(TkArticle::getCategoryId, categoryId);
        if (tag != null && !tag.isBlank()) qw.like(TkArticle::getTags, tag);
        if (keyword != null && !keyword.isBlank()) {
            qw.and(w -> w.like(TkArticle::getTitle, keyword).or().like(TkArticle::getSummary, keyword));
        }
        qw.orderByDesc(TkArticle::getIsTop);
        boolean asc = "asc".equalsIgnoreCase(sortOrder);
        if ("viewCount".equals(sortField)) {
            qw.orderBy(true, asc, TkArticle::getViewCount);
        } else if ("createdAt".equals(sortField)) {
            qw.orderBy(true, asc, TkArticle::getCreatedAt);
        } else {
            qw.orderByDesc(TkArticle::getUpdatedAt);
        }
        Page<TkArticle> p = articleMapper.selectPage(new Page<>(page, size), qw);
        p.getRecords().forEach(this::fillCategory);
        return p;
    }

    public TkArticle detail(Long id) {
        permissionService.require("article.view");
        TkArticle a = ownedArticle(id);
        fillCategory(a);
        return a;
    }

    /** 公开文章列表（无需登录，仅已发布） */
    public Page<TkArticle> publicPage(int page, int size, Long categoryId, String keyword,
                                      String sortField, String sortOrder) {
        LambdaQueryWrapper<TkArticle> qw = new LambdaQueryWrapper<TkArticle>()
                .eq(TkArticle::getStatus, "PUBLISHED");
        if (categoryId != null) qw.eq(TkArticle::getCategoryId, categoryId);
        if (keyword != null && !keyword.isBlank()) {
            qw.and(w -> w.like(TkArticle::getTitle, keyword).or().like(TkArticle::getTags, keyword));
        }
        qw.orderByDesc(TkArticle::getIsTop);
        boolean asc = "asc".equalsIgnoreCase(sortOrder);
        if ("viewCount".equals(sortField)) {
            qw.orderBy(true, asc, TkArticle::getViewCount);
        } else if ("createdAt".equals(sortField)) {
            qw.orderBy(true, asc, TkArticle::getCreatedAt);
        } else {
            qw.orderByDesc(TkArticle::getUpdatedAt);
        }
        Page<TkArticle> p = articleMapper.selectPage(new Page<>(page, size), qw);
        // 列表用于浏览与预览：正文与分享凭证都不外发，只带一个"是否已开启分享"的标记
        p.getRecords().forEach(a -> {
            fillCategory(a);
            a.setShared(isShared(a));
            a.setReadingMinutes(readingMinutes(a.getContentHtml() != null ? a.getContentHtml() : a.getContentMd()));
            a.setShareToken(null);
            a.setShareExpire(null);
            a.setSharePassword(null);
            a.setContentMd(null);
            a.setContentHtml(null);
        });
        return p;
    }

    /**
     * 公开文章详情（无需登录，仅已发布）。
     * 帖主开启分享后才返回全文；否则只给摘要与正文开头，供前端提示"帖主未开启文章分享"。
     */
    public TkArticle publicDetail(Long id) {
        TkArticle a = articleMapper.selectById(id);
        if (a == null || !"PUBLISHED".equals(a.getStatus())) throw new BizException("文章不存在或未发布");
        a.setViewCount((a.getViewCount() == null ? 0 : a.getViewCount()) + 1);
        articleMapper.updateById(a);
        fillCategory(a);
        boolean shared = isShared(a);
        a.setShared(shared);
        a.setReadingMinutes(readingMinutes(shared ? a.getContentHtml() : a.getContentMd()));
        if (!shared) {
            a.setPreviewHtml(buildPreviewHtml(a));
            a.setLockReason("帖主未开启文章分享");
            a.setContentHtml(null);
            a.setContentMd(null);
        }
        a.setShareToken(null);
        a.setShareExpire(null);
        a.setSharePassword(null);
        return a;
    }

    /** 分享凭证仍有效才算已开启分享（未设有效期视为长期有效） */
    private static boolean isShared(TkArticle a) {
        if (a.getShareToken() == null || a.getShareToken().isBlank()) return false;
        return a.getShareExpire() == null || a.getShareExpire().isAfter(LocalDateTime.now());
    }

    /** 未开启分享时展示的正文开头：有 HTML 就按块截断，只有 Markdown 就退化成纯文本 */
    private String buildPreviewHtml(TkArticle a) {
        String html = a.getContentHtml();
        if (html != null && !html.isBlank()) {
            int limit = 600;
            if (html.length() <= limit) return html;
            int cut = html.lastIndexOf('>', limit);
            return html.substring(0, cut <= 0 ? limit : cut + 1);
        }
        String md = a.getContentMd();
        if (md == null || md.isBlank()) return "";
        String plain = md
                .replaceAll("```[\\s\\S]*?```", " ")
                .replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)", " ")
                .replaceAll("\\[([^\\]]*)\\]\\([^)]*\\)", "$1")
                .replaceAll("(?m)^\\s{0,3}#{1,6}\\s*", "")
                .replaceAll("(?m)^\\s{0,3}[>\\-*+]\\s*", "")
                .replaceAll("[*_`~]", "")
                .replaceAll("\\s+", " ")
                .trim();
        if (plain.length() > 220) plain = plain.substring(0, 220) + "……";
        return plain.isBlank() ? "" : "<p>" + plain.replace("&", "&amp;").replace("<", "&lt;") + "</p>";
    }

    /** 估算阅读时长：中文按字、其它按词，约 300 字/分钟 */
    private static int readingMinutes(String content) {
        if (content == null || content.isBlank()) return 1;
        String plain = content.replaceAll("<[^>]+>", " ");
        int chinese = 0;
        int other = 0;
        for (int i = 0; i < plain.length(); i++) {
            char c = plain.charAt(i);
            if (c >= 0x3400 && c <= 0x9fff) chinese++;
            else if (Character.isLetterOrDigit(c)) other++;
        }
        return Math.max(1, (int) Math.ceil((chinese + other / 2.0) / 300.0));
    }

    /** 已发布文章封面图列表（首页轮播用，最多 limit 张） */
    public List<Map<String, Object>> listCovers(int limit, boolean carouselOnly) {
        permissionService.require("article.view");
        Page<TkArticle> p = articleMapper.selectPage(new Page<>(1, Math.min(limit, 6)),
                new LambdaQueryWrapper<TkArticle>()
                        .eq(TkArticle::getOwner, owner())
                        .eq(TkArticle::getStatus, "PUBLISHED")
                        .eq(carouselOnly, TkArticle::getIsCarousel, 1)
                        .orderByDesc(TkArticle::getIsTop)
                        .orderByDesc(TkArticle::getUpdatedAt));
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        Pattern htmlPattern = Pattern.compile("/api/tool/attachments/(\\d+)/content");
        Pattern mdPattern = Pattern.compile("attachment:(\\d+)");
        for (TkArticle a : p.getRecords()) {
            Long imgId = a.getCoverAttachId() != null ? a.getCoverAttachId()
                    : extractImageId(htmlPattern, mdPattern, a.getContentHtml(), a.getContentMd());
            String categoryPath = "";
            if (a.getCategoryId() != null) {
                ArticleCategory c = categoryMapper.selectById(a.getCategoryId());
                if (c != null) categoryPath = c.getPath();
            }
            Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("id", a.getId());
            item.put("title", a.getTitle());
            item.put("categoryPath", categoryPath);
            item.put("updatedAt", String.valueOf(a.getUpdatedAt()));
            item.put("imageUrl", imgId == null ? null : "/api/tool/attachments/" + imgId + "/content");
            out.add(item);
        }
        return out;
    }

    private static Long extractImageId(Pattern htmlPattern, Pattern mdPattern, String html, String md) {
        if (html != null) {
            Matcher m = htmlPattern.matcher(html);
            if (m.find()) return Long.parseLong(m.group(1));
        }
        if (md != null) {
            Matcher m = mdPattern.matcher(md);
            if (m.find()) return Long.parseLong(m.group(1));
        }
        return null;
    }

    /** 公开分类（含已发布文章数量，供文章展示页筛选） */
    public List<Map<String, Object>> publicCategories() {
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (ArticleCategory c : categoryMapper.selectList(new LambdaQueryWrapper<ArticleCategory>()
                .orderByAsc(ArticleCategory::getSortOrder).orderByAsc(ArticleCategory::getId))) {
            Long n = articleMapper.selectCount(new LambdaQueryWrapper<TkArticle>()
                    .eq(TkArticle::getCategoryId, c.getId()).eq(TkArticle::getStatus, "PUBLISHED"));
            if (n != null && n > 0) {
                out.add(Map.of("id", c.getId(), "name", c.getName(), "path", c.getPath(), "count", n));
            }
        }
        return out;
    }

    public TkArticle create(ArticleReq req) {
        permissionService.require("article.create");
        if (req.getTitle() == null || req.getTitle().isBlank()) throw new BizException("标题必填");
        TkArticle a = new TkArticle();
        apply(a, req);
        a.setOwner(owner());
        a.setViewCount(0);
        if (a.getCommentEnabled() == null) a.setCommentEnabled(1);
        a.setCreatedAt(LocalDateTime.now());
        a.setUpdatedAt(LocalDateTime.now());
        articleMapper.insert(a);
        fillCategory(a);
        logService.record(owner(), "CREATE_ARTICLE", "ARTICLE", a.getId(), "新建文章 " + a.getTitle());
        return a;
    }

    public TkArticle update(Long id, ArticleReq req) {
        permissionService.require("article.edit");
        TkArticle a = ownedArticle(id);
        apply(a, req);
        a.setUpdatedAt(LocalDateTime.now());
        articleMapper.updateById(a);
        fillCategory(a);
        logService.record(owner(), "UPDATE_ARTICLE", "ARTICLE", a.getId(), "修改文章 " + a.getTitle());
        return a;
    }

    public void delete(Long id) {
        permissionService.require("article.delete");
        ownedArticle(id);
        String title = articleMapper.selectById(id).getTitle();
        articleMapper.deleteById(id);
        logService.record(owner(), "DELETE_ARTICLE", "ARTICLE", id, "删除文章 " + title);
    }

    public TkArticle share(Long id, ShareReq req) {
        permissionService.require("article.edit");
        TkArticle a = ownedArticle(id);
        a.setShareToken(UUID.randomUUID().toString().replace("-", ""));
        int days = req.getDays() == null ? 7 : req.getDays();
        a.setShareExpire(LocalDateTime.now().plusDays(days));
        a.setSharePassword(req.getPassword() == null || req.getPassword().isBlank()
                ? null : passwordEncoder.encode(req.getPassword()));
        a.setUpdatedAt(LocalDateTime.now());
        articleMapper.updateById(a);
        logService.record(owner(), "SHARE_ARTICLE", "ARTICLE", a.getId(), "生成文章分享链接 " + a.getTitle());
        return a;
    }

    public void disableShare(Long id) {
        TkArticle a = ownedArticle(id);
        a.setShareToken(null);
        a.setShareExpire(null);
        a.setSharePassword(null);
        a.setUpdatedAt(LocalDateTime.now());
        articleMapper.updateById(a);
        logService.record(owner(), "DISABLE_ARTICLE_SHARE", "ARTICLE", a.getId(), "取消文章分享 " + a.getTitle());
    }

    public ShareAccessVO accessShare(String token, String password) {
        TkArticle a = articleMapper.selectOne(new LambdaQueryWrapper<TkArticle>()
                .eq(TkArticle::getShareToken, token));
        if (a == null) throw new BizException("分享链接不存在或已失效");
        if (a.getShareExpire() != null && a.getShareExpire().isBefore(LocalDateTime.now())) {
            throw new BizException("分享链接已过期");
        }
        ShareAccessVO vo = new ShareAccessVO();
        if (a.getSharePassword() != null) {
            if (password == null || password.isBlank()) {
                vo.setNeedPassword(true);
                return vo;
            }
            if (!passwordEncoder.matches(password, a.getSharePassword())) {
                throw new BizException("访问密码错误");
            }
        }
        a.setViewCount((a.getViewCount() == null ? 0 : a.getViewCount()) + 1);
        articleMapper.updateById(a);
        vo.setNeedPassword(false);
        vo.setArticle(a);
        return vo;
    }

    private void apply(TkArticle a, ArticleReq req) {
        if (req.getTitle() != null) a.setTitle(req.getTitle());
        a.setSummary(req.getSummary());
        a.setCategoryId(req.getCategoryId());
        a.setTags(req.getTags());
        if (req.getStatus() != null) a.setStatus(req.getStatus());
        a.setContentMd(req.getContentMd());
        a.setContentHtml(req.getContentHtml());
        a.setCoverAttachId(req.getCoverAttachId());
        if (req.getIsTop() != null) a.setIsTop(req.getIsTop());
        if (req.getIsFeatured() != null) a.setIsFeatured(req.getIsFeatured());
        if (req.getIsCarousel() != null) a.setIsCarousel(req.getIsCarousel());
        if (req.getCommentEnabled() != null) a.setCommentEnabled(req.getCommentEnabled() == 0 ? 0 : 1);
    }

    private void fillCategory(TkArticle a) {
        if (a.getCategoryId() != null) {
            ArticleCategory c = categoryMapper.selectById(a.getCategoryId());
            if (c != null) a.setCategoryPath(c.getPath());
        }
    }

    private TkArticle ownedArticle(Long id) {
        TkArticle a = articleMapper.selectById(id);
        if (a == null || !a.getOwner().equals(owner())) throw new BizException("文章不存在");
        return a;
    }

    private ArticleCategory ownedCategory(Long id) {
        ArticleCategory c = categoryMapper.selectById(id);
        if (c == null || !c.getOwner().equals(owner())) throw new BizException("分类不存在");
        return c;
    }
}
