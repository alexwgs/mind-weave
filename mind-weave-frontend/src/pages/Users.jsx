import { useEffect, useMemo, useState } from 'react'
import { Banner, Button, Empty, Input, Modal, Pagination, Radio, Select, Space, Switch, Table, Tag, Toast, Tooltip, Typography } from '@douyinfe/semi-ui'
import { IconDelete, IconEdit, IconKey, IconPlus, IconRefresh, IconSearch, IconUserGroup } from '@douyinfe/semi-icons'
import { userApi, permApi } from '../api'
import { useAuth } from '../auth'
import '../users.css'

const { Text } = Typography
const ROLE_LABEL = { ADMIN: '管理员', MANAGER: '数据维护', USER: '普通用户' }
const ROLE_COLOR = { ADMIN: 'red', MANAGER: 'orange', USER: 'blue' }
const SCOPE_LABEL = { ALL: '全部数据', GRADES: '仅指定级别', NONE: '不可查看工资数据' }
const PAGE_SIZE = 10

const PERMISSION_GROUPS = [
  { title: '我的空间', items: [['home', '成长工作台 / 人生 RPG'], ['articles', '知识库'], ['todos', '日程待办'], ['vault', '我的保险箱']] },
  { title: '收支管理', items: [['dashboard', '收支概览'], ['records', '工资记录'], ['comments', '字段批注'], ['import', '数据导入'], ['stats', '统计分析']] },
  { title: '管理与设置', items: [['users', '用户管理'], ['logs', '操作日志'], ['apis', 'API 管理'], ['settings', '系统设置']] }
]

const permissionOverridePayload = (row) => [
  ...(row.allowOverrides || []).map((code) => ({ code, type: 'ALLOW' })),
  ...(row.denyCodes || []).map((code) => ({ code, type: 'DENY' }))
]

export default function Users() {
  const auth = useAuth()
  const [users, setUsers] = useState([])
  const [perms, setPerms] = useState([])
  const [roleDefaults, setRoleDefaults] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [editVisible, setEditVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(null)
  const [form, setForm] = useState(null)
  const [permissionQuery, setPermissionQuery] = useState('')
  const [resetVisible, setResetVisible] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [userRows, permissionRows, defaults] = await Promise.all([userApi.list(), permApi.list(), permApi.roleDefaults()])
      setUsers(userRows || [])
      setPerms(permissionRows || [])
      setRoleDefaults(defaults || {})
    } catch (error) {
      setLoadError(error?.message || '用户数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [query, roleFilter, statusFilter])

  const permissionByCode = useMemo(() => Object.fromEntries(perms.map((item) => [item.code, item])), [perms])
  const actionMap = useMemo(() => {
    const map = {}
    perms.forEach((item) => {
      if (!item.code.includes('.')) return
      const prefix = item.code.split('.')[0]
      map[prefix] = map[prefix] || []
      map[prefix].push(item)
    })
    Object.values(map).forEach((items) => items.sort((a, b) => a.code.localeCompare(b.code)))
    return map
  }, [perms])

  const permissionSections = useMemo(() => {
    const used = new Set()
    const shortName = (item) => item.name?.includes('-') ? item.name.slice(item.name.indexOf('-') + 1) : item.name
    const sections = PERMISSION_GROUPS.map((group) => ({
      title: group.title,
      items: group.items.flatMap(([code, label]) => {
        if (!permissionByCode[code]) return []
        used.add(code)
        const actionPrefix = code === 'articles' ? 'article' : code === 'todos' ? 'todo' : code
        const children = (actionMap[actionPrefix] || []).map((item) => {
          used.add(item.code)
          return { code: item.code, label: shortName(item), action: true }
        })
        return [{ code, label, children }]
      })
    }))
    const extras = perms.filter((item) => !used.has(item.code)).map((item) => ({ code: item.code, label: item.name }))
    if (extras.length) sections.push({ title: '其他权限', items: extras })
    return sections
  }, [actionMap, permissionByCode, perms])

  const visiblePermissionSections = useMemo(() => {
    const needle = permissionQuery.trim().toLowerCase()
    if (!needle) return permissionSections
    return permissionSections.map((section) => ({
      ...section,
      items: section.items.flatMap((item) => {
        const ownMatch = `${item.label} ${item.code}`.toLowerCase().includes(needle)
        const children = (item.children || []).filter((child) => `${child.label} ${child.code}`.toLowerCase().includes(needle))
        return ownMatch || children.length ? [{ ...item, children: ownMatch ? item.children : children }] : []
      })
    })).filter((section) => section.items.length)
  }, [permissionQuery, permissionSections])

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesText = !needle || `${user.username} ${user.displayName || ''}`.toLowerCase().includes(needle)
      return matchesText && (roleFilter === 'ALL' || user.role === roleFilter)
        && (statusFilter === 'ALL' || (statusFilter === 'ENABLED' ? user.enabled === 1 : user.enabled !== 1))
    })
  }, [query, roleFilter, statusFilter, users])

  const pageUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const enabledAdmins = users.filter((user) => user.role === 'ADMIN' && user.enabled === 1).length
  const stats = {
    total: users.length,
    enabled: users.filter((user) => user.enabled === 1).length,
    admins: users.filter((user) => user.role === 'ADMIN').length,
    overrides: users.filter((user) => (user.allowOverrides?.length || 0) + (user.denyCodes?.length || 0) > 0).length
  }

  const emptyPermState = () => Object.fromEntries(perms.map((item) => [item.code, 'DEFAULT']))

  const openCreate = () => {
    setPermissionQuery('')
    setForm({ id: null, username: '', password: '', displayName: '', role: 'USER', enabled: 1, dataScope: 'ALL', scopeGrades: '', permState: emptyPermState() })
    setEditVisible(true)
  }

  const openEdit = (row) => {
    const permState = emptyPermState()
    ;(row.allowOverrides || []).forEach((code) => { permState[code] = 'ALLOW' })
    ;(row.denyCodes || []).forEach((code) => { permState[code] = 'DENY' })
    setPermissionQuery('')
    setForm({ id: row.id, username: row.username, password: '', displayName: row.displayName || '', role: row.role, enabled: row.enabled, dataScope: row.dataScope || 'ALL', scopeGrades: row.scopeGrades || '', permState })
    setEditVisible(true)
  }

  const validateForm = () => {
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(form.username.trim())) return '用户名须为 3-32 位字母、数字、点、横线或下划线'
    if (!form.id && form.password && form.password.length < 6) return '初始密码至少需要 6 位'
    if (form.dataScope === 'GRADES' && !form.scopeGrades.trim()) return '请填写至少一个可访问级别'
    return ''
  }

  const save = async () => {
    const error = validateForm()
    if (error) return Toast.warning(error)
    setSaving(true)
    try {
      const permissionOverrides = Object.entries(form.permState).filter(([, state]) => state !== 'DEFAULT').map(([code, type]) => ({ code, type }))
      const payload = {
        username: form.username.trim(), displayName: form.displayName.trim(), role: form.role, enabled: form.enabled,
        dataScope: form.dataScope, scopeGrades: form.dataScope === 'GRADES' ? form.scopeGrades : '', permissionOverrides
      }
      if (form.id) await userApi.update(form.id, payload)
      else await userApi.create({ ...payload, password: form.password })
      Toast.success(form.id ? '用户信息已更新' : '用户已创建')
      setEditVisible(false)
      await load()
    } catch { /* 请求层已展示详细错误 */ } finally { setSaving(false) }
  }

  const updateStatus = (row, enabled) => {
    const action = enabled ? '启用' : '禁用'
    Modal.confirm({
      title: `${action}用户`,
      content: enabled ? `启用 ${row.username} 后，该账号可以重新登录。` : `禁用 ${row.username} 后，该账号将无法再次登录。`,
      okText: action, okType: enabled ? 'primary' : 'danger',
      onOk: async () => {
        setStatusSaving(row.id)
        try {
          await userApi.update(row.id, { username: row.username, displayName: row.displayName || '', role: row.role, enabled: enabled ? 1 : 0, dataScope: row.dataScope || 'ALL', scopeGrades: row.scopeGrades || '', permissionOverrides: permissionOverridePayload(row) })
          Toast.success(`已${action} ${row.username}`)
          await load()
        } finally { setStatusSaving(null) }
      }
    })
  }

  const doReset = async () => {
    if (newPassword && newPassword.length < 6) return Toast.warning('新密码至少需要 6 位')
    if (newPassword !== confirmPassword) return Toast.warning('两次输入的密码不一致')
    setSaving(true)
    try {
      await userApi.resetPassword(resetTarget.id, newPassword || '123456')
      Toast.success(`已重置 ${resetTarget.username} 的密码`)
      setResetVisible(false)
    } catch { /* 请求层已展示详细错误 */ } finally { setSaving(false) }
  }

  const remove = (row) => Modal.confirm({
    title: '删除用户', content: `将永久删除用户 ${row.username} 及其个性化权限。此操作不可撤销。`, okText: '删除', okType: 'danger',
    onOk: async () => { await userApi.remove(row.id); Toast.success(`已删除 ${row.username}`); await load() }
  })

  const setPermissionState = (code, value) => setForm((current) => ({ ...current, permState: { ...current.permState, [code]: value } }))

  const renderPermission = (item, action = false) => {
    const defaultAllowed = roleDefaults[form.role]?.includes(item.code)
    return <div className={`user-permission-row ${action ? 'is-action' : ''}`} key={item.code}>
      <div><strong>{item.label}</strong><code>{item.code}</code></div>
      <Radio.Group type="button" buttonSize="small" value={form.permState[item.code] || 'DEFAULT'} onChange={(event) => setPermissionState(item.code, event.target.value)} options={[{ value: 'DEFAULT', label: defaultAllowed ? '默认允许' : '默认禁止' }, { value: 'ALLOW', label: '允许' }, { value: 'DENY', label: '禁止' }]} />
    </div>
  }

  const columns = [
    { title: '用户', width: 210, render: (_, row) => <div className="user-identity"><span>{(row.displayName || row.username).slice(0, 1).toUpperCase()}</span><div><strong>{row.displayName || row.username}</strong><small>@{row.username} · ID {row.id}</small></div></div> },
    { title: '角色', dataIndex: 'role', width: 110, render: (value) => <Tag color={ROLE_COLOR[value]}>{ROLE_LABEL[value] || value}</Tag> },
    { title: '数据范围', dataIndex: 'dataScope', width: 180, render: (value, row) => <div className="user-scope"><strong>{SCOPE_LABEL[value] || value}</strong>{value === 'GRADES' && <small>{row.scopeGrades || '尚未设置级别'}</small>}</div> },
    { title: '生效权限', dataIndex: 'permissions', width: 105, render: (value, row) => <div className="user-permission-count"><strong>{Array.isArray(value) ? value.length : 0}</strong><small>{(row.allowOverrides?.length || 0) + (row.denyCodes?.length || 0) ? '含个性覆盖' : '角色默认'}</small></div> },
    {
      title: '账号状态', width: 125,
      render: (_, row) => {
        const isSelf = row.username === auth.user?.username
        const isLastAdmin = row.role === 'ADMIN' && row.enabled === 1 && enabledAdmins <= 1
        return <Tooltip content={isSelf ? '不能禁用当前登录账号' : isLastAdmin ? '系统必须保留一个启用的管理员' : ''}><span><Switch aria-label={`${row.username}账号状态`} checked={row.enabled === 1} loading={statusSaving === row.id} disabled={isSelf || isLastAdmin || statusSaving !== null} onChange={(checked) => updateStatus(row, checked)} /><small className="user-status-text">{row.enabled === 1 ? '启用' : '禁用'}</small></span></Tooltip>
      }
    },
    {
      title: '操作', width: 150, fixed: 'right',
      render: (_, row) => {
        const isSelf = row.username === auth.user?.username
        const isLastAdmin = row.role === 'ADMIN' && row.enabled === 1 && enabledAdmins <= 1
        return <Space spacing={4}><Tooltip content="编辑用户"><Button aria-label={`编辑${row.username}`} size="small" type="tertiary" icon={<IconEdit />} onClick={() => openEdit(row)} /></Tooltip><Tooltip content="重置密码"><Button aria-label={`重置${row.username}密码`} size="small" type="tertiary" icon={<IconKey />} onClick={() => { setResetTarget(row); setNewPassword(''); setConfirmPassword(''); setResetVisible(true) }} /></Tooltip><Tooltip content={isSelf ? '不能删除当前登录账号' : isLastAdmin ? '不能删除最后一个启用的管理员' : '删除用户'}><span><Button aria-label={`删除${row.username}`} size="small" type="danger" theme="borderless" icon={<IconDelete />} disabled={isSelf || isLastAdmin} onClick={() => remove(row)} /></span></Tooltip></Space>
      }
    }
  ]

  const overrideCount = form ? Object.values(form.permState).filter((value) => value !== 'DEFAULT').length : 0
  const editingSelf = form?.username === auth.user?.username
  const editingLastAdmin = form?.role === 'ADMIN' && form?.enabled === 1 && enabledAdmins <= 1

  return <div className="users-page">
    <section className="users-hero"><div><span className="users-eyebrow"><IconUserGroup /> 身份与访问控制</span><h2>用户管理中心</h2><p>统一维护账号状态、角色、数据范围与精细权限。</p></div><Button theme="solid" size="large" icon={<IconPlus />} onClick={openCreate}>新增用户</Button></section>
    <section className="users-stat-grid" aria-label="用户统计"><div><span>全部账号</span><strong>{stats.total}</strong></div><div><span>启用账号</span><strong>{stats.enabled}</strong></div><div><span>管理员</span><strong>{stats.admins}</strong></div><div><span>个性权限</span><strong>{stats.overrides}</strong></div></section>

    <section className="page-card users-list-card">
      <div className="users-toolbar"><Input prefix={<IconSearch />} showClear value={query} onChange={setQuery} placeholder="搜索用户名或姓名" /><Select value={roleFilter} onChange={setRoleFilter} optionList={[{ value: 'ALL', label: '全部角色' }, ...Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))]} /><Select value={statusFilter} onChange={setStatusFilter} optionList={[{ value: 'ALL', label: '全部状态' }, { value: 'ENABLED', label: '已启用' }, { value: 'DISABLED', label: '已禁用' }]} /><Tooltip content="刷新"><Button aria-label="刷新用户列表" icon={<IconRefresh />} loading={loading} onClick={load} /></Tooltip><Text type="tertiary">共 {filteredUsers.length} 个结果</Text></div>
      {loadError && <Banner type="danger" description={loadError} closeIcon={null} action={<Button size="small" onClick={load}>重新加载</Button>} />}
      {!loadError && !loading && filteredUsers.length === 0 ? <Empty description="没有找到符合条件的用户" /> : <Table columns={columns} dataSource={pageUsers} rowKey="id" loading={loading} pagination={false} scroll={{ x: 900 }} />}
      {filteredUsers.length > PAGE_SIZE && <div className="users-pagination"><Pagination currentPage={page} pageSize={PAGE_SIZE} total={filteredUsers.length} showTotal onPageChange={setPage} /></div>}
    </section>

    <Modal className="user-editor-modal" title={form?.id ? `编辑用户 · ${form.username}` : '创建新用户'} visible={editVisible} onOk={save} onCancel={() => setEditVisible(false)} okText="保存用户" cancelText="取消" confirmLoading={saving} width={Math.min(860, window.innerWidth - 24)} style={{ top: 20 }}>
      {form && <div className="user-editor-body">
        {(editingSelf || editingLastAdmin) && <Banner type="info" description={editingSelf ? '这是当前登录账号，为避免失去管理入口，不能禁用或取消管理员角色。' : '这是最后一个启用的管理员，必须先启用其他管理员才能降级或禁用。'} closeIcon={null} />}
        <section className="user-form-section"><div className="user-section-heading"><strong>基本信息</strong><span>登录身份与账号状态</span></div><div className="user-form-grid">
          <label><span>用户名 *</span><Input value={form.username} disabled={!!form.id} maxLength={32} onChange={(value) => setForm({ ...form, username: value })} placeholder="3-32 位字母、数字或 ._-" /></label>
          <label><span>显示名称</span><Input value={form.displayName} maxLength={40} onChange={(value) => setForm({ ...form, displayName: value })} placeholder="用于界面展示" /></label>
          {!form.id && <label><span>初始密码</span><Input mode="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} placeholder="留空时使用 123456" /></label>}
          <label><span>角色 *</span><Select value={form.role} disabled={editingSelf || editingLastAdmin} onChange={(value) => setForm({ ...form, role: value })} optionList={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} /></label>
          <label className="user-switch-field"><span>账号状态</span><div><Switch checked={form.enabled === 1} disabled={editingSelf || editingLastAdmin} onChange={(checked) => setForm({ ...form, enabled: checked ? 1 : 0 })} /><Text>{form.enabled ? '允许登录' : '禁止登录'}</Text></div></label>
        </div></section>
        <section className="user-form-section"><div className="user-section-heading"><strong>工资数据范围</strong><span>限制该用户可以查看的工资记录</span></div><Radio.Group value={form.dataScope} onChange={(event) => setForm({ ...form, dataScope: event.target.value })} options={Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label }))} />{form.dataScope === 'GRADES' && <Input className="user-grade-input" value={form.scopeGrades} onChange={(value) => setForm({ ...form, scopeGrades: value })} placeholder="输入级别并用逗号分隔，例如 A,B,C" showClear />}</section>
        <section className="user-form-section user-permission-section"><div className="user-section-heading user-permission-heading"><div><strong>精细权限</strong><span>“默认”跟随角色；个性覆盖会优先于角色权限</span></div><Space><Tag color={overrideCount ? 'blue' : 'grey'}>{overrideCount} 项覆盖</Tag><Button size="small" disabled={!overrideCount} onClick={() => setForm((current) => ({ ...current, permState: emptyPermState() }))}>恢复角色默认</Button></Space></div><Input prefix={<IconSearch />} showClear value={permissionQuery} onChange={setPermissionQuery} placeholder="搜索权限名称或代码" /><div className="user-permission-groups">{visiblePermissionSections.map((section) => <div className="user-permission-group" key={section.title}><h4>{section.title}</h4>{section.items.map((item) => <div className="user-permission-item" key={item.code}>{renderPermission(item)}{(item.children || []).map((child) => renderPermission(child, true))}</div>)}</div>)}{!visiblePermissionSections.length && <Empty description="没有匹配的权限" />}</div></section>
      </div>}
    </Modal>

    <Modal title={`重置密码 · ${resetTarget?.username || ''}`} visible={resetVisible} onOk={doReset} onCancel={() => setResetVisible(false)} okText="确认重置" cancelText="取消" confirmLoading={saving} width={Math.min(440, window.innerWidth - 24)}><div className="user-reset-form"><Banner type="warning" description="留空将重置为默认密码 123456；建议设置至少 6 位的新密码。" closeIcon={null} /><label><span>新密码</span><Input mode="password" value={newPassword} onChange={setNewPassword} placeholder="输入新密码或留空" /></label><label><span>再次确认</span><Input mode="password" value={confirmPassword} disabled={!newPassword} onChange={setConfirmPassword} placeholder="再次输入新密码" /></label></div></Modal>
  </div>
}
