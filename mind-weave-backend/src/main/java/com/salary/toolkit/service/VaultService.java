package com.salary.toolkit.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.salary.common.BizException;
import com.salary.security.SecurityUtils;
import com.salary.toolkit.config.VaultCrypto;
import com.salary.toolkit.dto.RevealVO;
import com.salary.toolkit.dto.VaultFieldReq;
import com.salary.toolkit.dto.VaultItemReq;
import com.salary.toolkit.dto.VaultItemVO;
import com.salary.toolkit.entity.TkSetting;
import com.salary.toolkit.entity.VaultField;
import com.salary.toolkit.entity.VaultGroup;
import com.salary.toolkit.entity.VaultItem;
import com.salary.toolkit.mapper.TkAttachmentMapper;
import com.salary.toolkit.mapper.TkSettingMapper;
import com.salary.toolkit.mapper.VaultFieldMapper;
import com.salary.toolkit.mapper.VaultGroupMapper;
import com.salary.toolkit.mapper.VaultItemMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VaultService {
    private static final String MASK = "******";

    private final VaultGroupMapper groupMapper;
    private final VaultItemMapper itemMapper;
    private final VaultFieldMapper fieldMapper;
    private final TkAttachmentMapper attachmentMapper;
    private final TkSettingMapper settingMapper;
    private final VaultCrypto crypto;
    private final PasswordEncoder passwordEncoder;
    private final AttachmentService attachmentService;
    private final com.salary.service.PermissionService permissionService;
    private final com.salary.service.LogService logService;

    private String owner() {
        return SecurityUtils.currentUsername();
    }

    // ---------------- 分组 ----------------
    public List<VaultGroup> listGroups() {
        permissionService.require("vault.view");
        return groupMapper.selectList(new LambdaQueryWrapper<VaultGroup>()
                .eq(VaultGroup::getOwner, owner())
                .orderByAsc(VaultGroup::getSortOrder)
                .orderByAsc(VaultGroup::getId));
    }

    /** 分组及数量汇总（仪表盘用） */
    public List<Map<String, Object>> groupSummary() {
        permissionService.require("vault.view");
        List<Map<String, Object>> out = new ArrayList<>();
        for (VaultGroup g : listGroups()) {
            Long c = itemMapper.selectCount(new LambdaQueryWrapper<VaultItem>()
                    .eq(VaultItem::getOwner, owner()).eq(VaultItem::getGroupId, g.getId()));
            out.add(Map.of("id", g.getId(), "name", g.getName(), "count", c == null ? 0 : c));
        }
        Long none = itemMapper.selectCount(new LambdaQueryWrapper<VaultItem>()
                .eq(VaultItem::getOwner, owner()).isNull(VaultItem::getGroupId));
        out.add(Map.of("id", 0, "name", "未分组", "count", none == null ? 0 : none));
        return out;
    }

    public VaultGroup createGroup(String name, Integer sortOrder) {
        permissionService.require("vault.create");
        VaultGroup g = new VaultGroup();
        g.setOwner(owner());
        g.setName(name);
        g.setSortOrder(sortOrder == null ? 0 : sortOrder);
        g.setCreatedAt(LocalDateTime.now());
        g.setUpdatedAt(LocalDateTime.now());
        groupMapper.insert(g);
        logService.record(owner(), "CREATE_VAULT_GROUP", "VAULT_GROUP", g.getId(), "新建分组 " + g.getName());
        return g;
    }

    public VaultGroup updateGroup(Long id, String name, Integer sortOrder) {
        permissionService.require("vault.edit");
        VaultGroup g = ownedGroup(id);
        if (name != null) g.setName(name);
        if (sortOrder != null) g.setSortOrder(sortOrder);
        g.setUpdatedAt(LocalDateTime.now());
        groupMapper.updateById(g);
        logService.record(owner(), "UPDATE_VAULT_GROUP", "VAULT_GROUP", g.getId(), "修改分组 " + g.getName());
        return g;
    }

    @Transactional
    public void deleteGroup(Long id) {
        permissionService.require("vault.delete");
        VaultGroup g = ownedGroup(id);
        List<VaultItem> items = itemMapper.selectList(new LambdaQueryWrapper<VaultItem>()
                .eq(VaultItem::getOwner, owner()).eq(VaultItem::getGroupId, id));
        for (VaultItem item : items) {
            delete(item.getId());
        }
        groupMapper.deleteById(id);
        logService.record(owner(), "DELETE_VAULT_GROUP", "VAULT_GROUP", id, "删除分组 " + g.getName());
    }

    // ---------------- 条目 ----------------
    public Page<VaultItemVO> pageItems(int page, int size, Long groupId, String keyword) {
        permissionService.require("vault.view");
        LambdaQueryWrapper<VaultItem> qw = new LambdaQueryWrapper<VaultItem>()
                .eq(VaultItem::getOwner, owner());
        if (groupId != null) qw.eq(VaultItem::getGroupId, groupId);
        if (keyword != null && !keyword.isBlank()) {
            qw.and(w -> w.like(VaultItem::getName, keyword).or().like(VaultItem::getNote, keyword));
        }
        qw.orderByDesc(VaultItem::getUpdatedAt);
        Page<VaultItem> p = itemMapper.selectPage(new Page<>(page, size), qw);
        Page<VaultItemVO> vo = new Page<>(p.getCurrent(), p.getSize(), p.getTotal());
        vo.setRecords(p.getRecords().stream().map(this::toVO).collect(Collectors.toList()));
        return vo;
    }

    public VaultItemVO detail(Long id) {
        permissionService.require("vault.view");
        return toVO(ownedItem(id));
    }

    @Transactional
    public VaultItemVO create(VaultItemReq req) {
        permissionService.require("vault.create");
        if (req.getName() == null || req.getName().isBlank()) throw new BizException("名称必填");
        VaultItem item = new VaultItem();
        item.setOwner(owner());
        item.setGroupId(req.getGroupId());
        item.setName(req.getName().trim());
        item.setAccount(crypto.encrypt(req.getAccount()));
        item.setPassword(crypto.encrypt(req.getPassword()));
        item.setNote(req.getNote());
        item.setCreatedAt(LocalDateTime.now());
        item.setUpdatedAt(LocalDateTime.now());
        itemMapper.insert(item);
        saveFields(item.getId(), req.getFields(), null);
        logService.record(owner(), "CREATE_VAULT_ITEM", "VAULT_ITEM", item.getId(), "新增凭证 " + item.getName());
        return toVO(item);
    }

    @Transactional
    public VaultItemVO update(Long id, VaultItemReq req) {
        permissionService.require("vault.edit");
        VaultItem item = ownedItem(id);
        if (req.getName() != null && !req.getName().isBlank()) item.setName(req.getName().trim());
        if (req.getGroupId() != null) item.setGroupId(req.getGroupId());
        if (req.getAccount() != null && !MASK.equals(req.getAccount())) item.setAccount(crypto.encrypt(req.getAccount()));
        if (req.getPassword() != null && !req.getPassword().isEmpty() && !MASK.equals(req.getPassword())) {
            item.setPassword(crypto.encrypt(req.getPassword()));
        }
        if (req.getNote() != null) item.setNote(req.getNote());
        item.setUpdatedAt(LocalDateTime.now());
        itemMapper.updateById(item);
        logService.record(owner(), "UPDATE_VAULT_ITEM", "VAULT_ITEM", id, "修改凭证 " + item.getName());
        List<VaultField> old = fieldMapper.selectList(new LambdaQueryWrapper<VaultField>()
                .eq(VaultField::getItemId, id));
        saveFields(id, req.getFields(), old);
        return toVO(item);
    }

    @Transactional
    public void delete(Long id) {
        permissionService.require("vault.delete");
        VaultItem item = ownedItem(id);
        fieldMapper.delete(new LambdaQueryWrapper<VaultField>().eq(VaultField::getItemId, id));
        attachmentService.deleteByBiz("VAULT", id);
        logService.record(owner(), "DELETE_VAULT_ITEM", "VAULT_ITEM", id, "删除凭证 " + item.getName());
        itemMapper.deleteById(id);
    }

    public RevealVO reveal(Long id) {
        permissionService.require("vault.view");
        VaultItem item = ownedItem(id);
        item.setLastViewAt(LocalDateTime.now());
        itemMapper.updateById(item);
        logService.record(owner(), "VIEW_VAULT_ITEM", "VAULT_ITEM", id, "查看凭证 " + item.getName());
        RevealVO vo = new RevealVO(crypto.decrypt(item.getAccount()), crypto.decrypt(item.getPassword()),
                fieldMapper.selectList(new LambdaQueryWrapper<VaultField>()
                .eq(VaultField::getItemId, id)).stream()
                .map(f -> new VaultFieldReq(f.getFieldKey(), crypto.decrypt(f.getFieldValue())))
                .collect(Collectors.toList()));
        return vo;
    }

    // ---------------- PIN ----------------
    public void setPin(String pin) {
        if (pin == null || pin.length() < 4) throw new BizException("PIN 码至少 4 位");
        upsertSetting("vault.pin", passwordEncoder.encode(pin));
        logService.record(owner(), "SET_VAULT_PIN", "VAULT", null, "设置保险箱 PIN 码");
    }

    public void verifyPin(String pin) {
        TkSetting s = setting("vault.pin");
        if (s == null || s.getSetValue() == null || s.getSetValue().isBlank()) {
            throw new BizException("尚未设置 PIN 码，请先到「我的-设置」创建");
        }
        if (!passwordEncoder.matches(pin == null ? "" : pin, s.getSetValue())) {
            throw new BizException("PIN 码错误");
        }
    }

    // ---------------- 内部 ----------------
    private void saveFields(Long itemId, List<VaultFieldReq> reqs, List<VaultField> old) {
        fieldMapper.delete(new LambdaQueryWrapper<VaultField>().eq(VaultField::getItemId, itemId));
        if (reqs == null) return;
        for (VaultFieldReq r : reqs) {
            if (r.getKey() == null || r.getKey().isBlank()) continue;
            String value = r.getValue();
            if (MASK.equals(value) && old != null) {
                value = old.stream()
                        .filter(f -> f.getFieldKey().equals(r.getKey().trim()))
                        .map(VaultField::getFieldValue)
                        .findFirst().orElse(null);
            } else if (value != null && !value.isEmpty()) {
                value = crypto.encrypt(value);
            }
            VaultField f = new VaultField();
            f.setItemId(itemId);
            f.setFieldKey(r.getKey().trim());
            f.setFieldValue(value);
            fieldMapper.insert(f);
        }
    }

    private VaultItemVO toVO(VaultItem item) {
        VaultItemVO vo = new VaultItemVO();
        vo.setId(item.getId());
        vo.setGroupId(item.getGroupId());
        vo.setName(item.getName());
        vo.setAccountMasked(mask(item.getAccount()));
        vo.setPasswordMasked(mask(item.getPassword()));
        vo.setNote(item.getNote());
        vo.setLastViewAt(item.getLastViewAt());
        vo.setCreatedAt(item.getCreatedAt());
        vo.setUpdatedAt(item.getUpdatedAt());
        List<VaultField> fields = fieldMapper.selectList(new LambdaQueryWrapper<VaultField>()
                .eq(VaultField::getItemId, item.getId()));
        vo.setFields(fields.stream()
                .map(f -> new VaultFieldReq(f.getFieldKey(), mask(f.getFieldValue())))
                .collect(Collectors.toList()));
        vo.setAttachmentCount(attachmentMapper.selectCount(new LambdaQueryWrapper<com.salary.toolkit.entity.TkAttachment>()
                .eq(com.salary.toolkit.entity.TkAttachment::getOwner, item.getOwner())
                .eq(com.salary.toolkit.entity.TkAttachment::getBizType, "VAULT")
                .eq(com.salary.toolkit.entity.TkAttachment::getBizId, item.getId())));
        return vo;
    }

    private static String mask(String v) {
        return (v == null || v.isEmpty()) ? "" : MASK;
    }

    private VaultGroup ownedGroup(Long id) {
        VaultGroup g = groupMapper.selectById(id);
        if (g == null || !g.getOwner().equals(owner())) throw new BizException("分组不存在");
        return g;
    }

    private VaultItem ownedItem(Long id) {
        VaultItem item = itemMapper.selectById(id);
        if (item == null || !item.getOwner().equals(owner())) throw new BizException("凭证不存在");
        return item;
    }

    private TkSetting setting(String key) {
        return settingMapper.selectOne(new LambdaQueryWrapper<TkSetting>()
                .eq(TkSetting::getOwner, owner()).eq(TkSetting::getSetKey, key));
    }

    private void upsertSetting(String key, String value) {
        TkSetting s = setting(key);
        if (s == null) {
            s = new TkSetting();
            s.setOwner(owner());
            s.setSetKey(key);
            s.setSetValue(value);
            s.setUpdatedAt(LocalDateTime.now());
            settingMapper.insert(s);
        } else {
            s.setSetValue(value);
            s.setUpdatedAt(LocalDateTime.now());
            settingMapper.updateById(s);
        }
    }

}
