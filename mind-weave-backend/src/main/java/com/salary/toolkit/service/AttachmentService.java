package com.salary.toolkit.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.salary.common.BizException;
import com.salary.security.SecurityUtils;
import com.salary.toolkit.config.ToolkitProperties;
import com.salary.toolkit.entity.TkAttachment;
import com.salary.toolkit.mapper.TkAttachmentMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AttachmentService {
    private final TkAttachmentMapper attachmentMapper;
    private final ToolkitProperties props;
    private final com.salary.service.PermissionService permissionService;
    private final com.salary.service.LogService logService;

    private String owner() {
        return SecurityUtils.currentUsername();
    }

    public TkAttachment upload(MultipartFile file, String bizType, Long bizId) {
        if (file == null || file.isEmpty()) throw new BizException("文件为空");
        String type = (bizType == null || bizType.isBlank()) ? "ARTICLE" : bizType.toUpperCase();
        permissionService.require("VAULT".equals(type) ? "vault.create" : "article.edit");
        long max = "VAULT".equals(type) ? 5L * 1024 * 1024 : props.getMaxFileMb() * 1024L * 1024;
        if (file.getSize() > max) throw new BizException("文件超过大小限制");

        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) ext = original.substring(dot).toLowerCase();
        String stored = UUID.randomUUID().toString().replace("-", "") + ext;
        String sub = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        try {
            Path dir = Paths.get(props.getUploadDir(), type.toLowerCase(), sub).toAbsolutePath().normalize();
            Files.createDirectories(dir);
            Path target = dir.resolve(stored);
            file.transferTo(target.toFile());

            TkAttachment a = new TkAttachment();
            a.setOwner(owner());
            a.setBizType(type);
            a.setBizId(bizId);
            a.setOriginalName(original);
            a.setStoredName(stored);
            a.setStoragePath(target.toString());
            a.setMime(file.getContentType());
            a.setSizeBytes(file.getSize());
            if (file.getContentType() != null && file.getContentType().startsWith("image/")) {
                try {
                    BufferedImage img = ImageIO.read(target.toFile());
                    if (img != null) {
                        a.setWidth(img.getWidth());
                        a.setHeight(img.getHeight());
                    }
                } catch (Exception ignored) {
                }
            }
            a.setCreatedAt(LocalDateTime.now());
            attachmentMapper.insert(a);
            logService.record(owner(), "UPLOAD_ATTACHMENT", "ATTACHMENT", a.getId(),
                    "上传附件 " + a.getOriginalName() + "（" + type + "）");
            return a;
        } catch (Exception e) {
            throw new BizException("上传失败: " + e.getMessage());
        }
    }

    public List<TkAttachment> list(String bizType, Long bizId) {
        String type = (bizType == null || bizType.isBlank()) ? "ARTICLE" : bizType.toUpperCase();
        return attachmentMapper.selectList(new LambdaQueryWrapper<TkAttachment>()
                .eq(TkAttachment::getOwner, owner())
                .eq(TkAttachment::getBizType, type)
                .eq(bizId != null, TkAttachment::getBizId, bizId)
                .orderByDesc(TkAttachment::getCreatedAt));
    }

    public ResponseEntity<org.springframework.core.io.Resource> download(Long id) {
        TkAttachment a = attachmentMapper.selectById(id);
        if (a == null) throw new BizException("附件不存在");
        // 文章附件与 content 同样公开：公开文章里的下载链接由浏览器直接发起，带不上 Authorization 头。
        // 保险箱等其它类型仍需校验归属。
        if (!"ARTICLE".equalsIgnoreCase(a.getBizType()) && !a.getOwner().equals(owner())) {
            throw new BizException("附件不存在");
        }
        return resource(a, "attachment; filename*=UTF-8''" + enc(a.getOriginalName()));
    }

    public ResponseEntity<org.springframework.core.io.Resource> content(Long id) {
        TkAttachment a = attachmentMapper.selectById(id);
        if (a == null) throw new BizException("附件不存在");
        // 文章类附件（正文图片/视频/封面）允许公开访问，供浏览器 <img>/<video> 直接加载
        if (!"ARTICLE".equalsIgnoreCase(a.getBizType())) {
            if (!a.getOwner().equals(owner())) throw new BizException("附件不存在");
        }
        return resource(a, "inline");
    }

    public void delete(Long id) {
        TkAttachment a = owned(id);
        permissionService.require("VAULT".equals(a.getBizType()) ? "vault.delete" : "article.edit");
        deleteFile(a);
        logService.record(owner(), "DELETE_ATTACHMENT", "ATTACHMENT", id, "删除附件 " + a.getOriginalName());
        attachmentMapper.deleteById(id);
    }

    public void deleteByBiz(String bizType, Long bizId) {
        List<TkAttachment> list = attachmentMapper.selectList(new LambdaQueryWrapper<TkAttachment>()
                .eq(TkAttachment::getOwner, owner())
                .eq(TkAttachment::getBizType, bizType.toUpperCase())
                .eq(TkAttachment::getBizId, bizId));
        for (TkAttachment a : list) {
            deleteFile(a);
            attachmentMapper.deleteById(a.getId());
        }
    }

    private TkAttachment owned(Long id) {
        TkAttachment a = attachmentMapper.selectById(id);
        if (a == null || !a.getOwner().equals(owner())) throw new BizException("附件不存在");
        return a;
    }

    private ResponseEntity<org.springframework.core.io.Resource> resource(TkAttachment a, String disposition) {
        File f = new File(a.getStoragePath());
        if (!f.exists()) throw new BizException("文件已丢失");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .contentType(resolveMediaType(a))
                .contentLength(f.length())
                .body(new FileSystemResource(f));
    }

    /**
     * 优先用上传时记录的 MIME；缺失或无法解析时按扩展名推断，
     * 否则 PDF / Word / Excel 会被当成 octet-stream 而只能下载、无法内联查看。
     */
    private static MediaType resolveMediaType(TkAttachment a) {
        String mime = a.getMime();
        if (mime != null && !mime.isBlank()) {
            try {
                return MediaType.parseMediaType(mime);
            } catch (Exception ignored) {
                // 记录值不合法时继续按扩展名推断
            }
        }
        String name = a.getOriginalName() != null ? a.getOriginalName() : a.getStoredName();
        return MediaTypeFactory.getMediaType(name == null ? "" : name)
                .orElse(MediaType.APPLICATION_OCTET_STREAM);
    }

    private void deleteFile(TkAttachment a) {
        try {
            Files.deleteIfExists(Paths.get(a.getStoragePath()));
        } catch (Exception ignored) {
        }
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
