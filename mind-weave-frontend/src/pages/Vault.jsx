import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button, Descriptions, Empty, Input, Modal, Select, Space, Table, Tag, TextArea, Toast,
  Typography, Popconfirm, Tooltip
} from '@douyinfe/semi-ui'
import {
  IconCopy, IconDelete, IconEdit, IconEyeClosed, IconEyeOpened, IconPlus, IconRefresh,
  IconSearch, IconUpload, IconDownload
} from '@douyinfe/semi-icons'
import { toolApi } from '../api'
import { fmtDateTime } from '../utils/datetime'

const { Title, Text } = Typography
const MASK = '******'

function randInt(max) {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % max
}

function genPassword(len = 18) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%^&*()-_=+']
  const all = sets.join('')
  const arr = [0, 1, 2, 3].map((i) => sets[i][randInt(sets[i].length)])
  while (arr.length < len) arr.push(all[randInt(all.length)])
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text || '')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text || ''
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  Toast.success('已复制到剪贴板')
}

export default function Vault() {
  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [groupModal, setGroupModal] = useState(false)
  const [groupForm, setGroupForm] = useState({ id: null, name: '', sortOrder: 0 })
  const [itemModal, setItemModal] = useState(false)
  const [itemForm, setItemForm] = useState(null)
  const [reveal, setReveal] = useState(null)
  const [showPlain, setShowPlain] = useState(false)
  const [attachments, setAttachments] = useState([])
  const plainTimer = useRef(null)

  const loadGroups = async () => {
    const g = await toolApi.vaultGroups()
    setGroups(g)
  }

  const loadItems = async (p = page, gid = groupId) => {
    setLoading(true)
    try {
      const data = await toolApi.vaultItems({ page: p, size: 20, groupId: gid || undefined, keyword: keyword || undefined })
      setRows(data.records)
      setTotal(data.total)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadGroups() }, [])
  useEffect(() => { loadItems(1, groupId) }, [groupId]) // eslint-disable-line

  const groupName = useMemo(() => {
    const g = groups.find((x) => x.id === groupId)
    return g ? g.name : '全部'
  }, [groups, groupId])

  const openReveal = async (row) => {
    const data = await toolApi.vaultReveal(row.id)
    setReveal({ ...row, ...data })
    setShowPlain(false)
    loadAttachments(row.id)
  }

  const loadAttachments = async (bizId) => {
    const list = await toolApi.listAttachments({ bizType: 'VAULT', bizId })
    setAttachments(list)
  }

  const onUpload = async (e, bizId) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      Toast.error('附件不能超过 5MB')
      return
    }
    await toolApi.uploadAttachment(file, 'VAULT', bizId)
    Toast.success('上传成功')
    loadAttachments(bizId)
    e.target.value = ''
  }

  const onDownload = (a) => {
    window.open(toolApi.attachmentUrl(a.id, 'download'), '_blank')
  }

  const togglePlain = () => {
    if (showPlain) {
      setShowPlain(false)
      return
    }
    setShowPlain(true)
    clearTimeout(plainTimer.current)
    plainTimer.current = setTimeout(() => setShowPlain(false), 5000)
  }

  const openItemForm = (row) => {
    setItemForm({
      id: row?.id || null,
      groupId: row?.groupId ?? groupId ?? null,
      name: row?.name || '',
      account: row?.accountMasked || '',
      password: row?.passwordMasked || '',
      note: row?.note || '',
      fields: row?.fields?.length ? row.fields.map((f) => ({ ...f })) : [{ key: '', value: '' }]
    })
    setItemModal(true)
  }

  const saveItem = async () => {
    const f = itemForm
    if (!f.name.trim()) {
      Toast.warning('名称必填')
      return
    }
    const payload = {
      groupId: f.groupId || null,
      name: f.name.trim(),
      account: f.account || '',
      password: f.password || '',
      note: f.note || '',
      fields: f.fields.filter((x) => x.key.trim()).map((x) => ({ key: x.key.trim(), value: x.value || '' }))
    }
    if (f.id) await toolApi.updateVaultItem(f.id, payload)
    else await toolApi.createVaultItem(payload)
    Toast.success('保存成功')
    setItemModal(false)
    loadItems()
  }

  const columns = [
    { title: '名称', dataIndex: 'name', render: (v) => <Text strong>{v}</Text> },
    {
      title: '账号', dataIndex: 'accountMasked', width: 180,
      render: (v, r) => (
        <Space>
          <Text type="tertiary">{v || '—'}</Text>
          {v && <Button size="small" icon={<IconCopy />} onClick={() => copyText(v)} />}
        </Space>
      )
    },
    {
      title: '密码', dataIndex: 'passwordMasked', width: 180,
      render: (v) => <Text type="tertiary">{v || '—'}</Text>
    },
    { title: '备注', dataIndex: 'note', ellipsis: true, render: (v) => v || '—' },
    {
      title: '上次查看', dataIndex: 'lastViewAt', width: 170,
      render: (v) => (v ? fmtDateTime(v) : '—')
    },
    {
      title: '操作', dataIndex: 'op', width: 260,
      render: (_, r) => (
        <Space>
          <Tooltip content="查看"><Button size="small" icon={<IconEyeOpened />} onClick={() => openReveal(r)} /></Tooltip>
          <Tooltip content="复制账号"><Button size="small" icon={<IconCopy />} onClick={() => copyText(r.accountMasked)} /></Tooltip>
          <Tooltip content="编辑"><Button size="small" icon={<IconEdit />} onClick={() => openItemForm(r)} /></Tooltip>
          <Popconfirm title="确定删除该凭证？" onConfirm={async () => { await toolApi.deleteVaultItem(r.id); Toast.success('已删除'); loadItems() }}>
            <Button size="small" type="danger" icon={<IconDelete />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      <div style={{ width: 220, background: 'var(--semi-color-bg-1)', borderRadius: 8, padding: 16, flexShrink: 0 }}>
        <Space vertical style={{ width: '100%' }}>
          <Button block icon={<IconPlus />} onClick={() => { setGroupForm({ id: null, name: '', sortOrder: 0 }); setGroupModal(true) }}>
            新建分组
          </Button>
          <div
            onClick={() => setGroupId(null)}
            style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer', background: groupId === null ? '#e8f0ff' : 'transparent', color: groupId === null ? '#0061ff' : '#1f2329' }}
          >
            全部凭证
          </div>
          {groups.map((g) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', background: groupId === g.id ? '#e8f0ff' : 'transparent' }}>
              <span onClick={() => setGroupId(g.id)} style={{ flex: 1, color: groupId === g.id ? '#0061ff' : '#1f2329' }}>{g.name}</span>
              <Space>
                <Button size="small" theme="borderless" icon={<IconEdit />} onClick={() => { setGroupForm({ id: g.id, name: g.name, sortOrder: g.sortOrder }); setGroupModal(true) }} />
                <Popconfirm title="删除分组会删除其下所有凭证" onConfirm={async () => { await toolApi.deleteVaultGroup(g.id); loadGroups(); if (groupId === g.id) setGroupId(null) }}>
                  <Button size="small" theme="borderless" type="danger" icon={<IconDelete />} />
                </Popconfirm>
              </Space>
            </div>
          ))}
        </Space>
      </div>

      <div style={{ flex: 1, background: 'var(--semi-color-bg-1)', borderRadius: 8, padding: 16, overflow: 'auto' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title heading={5} style={{ margin: 0 }}>{groupName}凭证</Title>
          <Space>
            <Input prefix={<IconSearch />} placeholder="搜索名称/备注" value={keyword} onChange={setKeyword} onEnterPress={() => loadItems(1)} style={{ width: 220 }} />
            <Button onClick={() => loadItems(1)}>搜索</Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => openItemForm(null)}>新增凭证</Button>
          </Space>
        </Space>
        <Table columns={columns} dataSource={rows} loading={loading} rowKey="id"
          pagination={{ current: page, pageSize: 20, total, onChange: (p) => loadItems(p) }} />
      </div>

      {/* 分组弹窗 */}
      <Modal title={groupForm.id ? '编辑分组' : '新建分组'} visible={groupModal} onCancel={() => setGroupModal(false)}
        onOk={async () => {
          if (!groupForm.name.trim()) { Toast.warning('请输入名称'); return }
          if (groupForm.id) await toolApi.updateVaultGroup(groupForm.id, groupForm)
          else await toolApi.createVaultGroup(groupForm)
          setGroupModal(false); loadGroups()
        }}>
        <Input placeholder="分组名称" value={groupForm.name} onChange={(v) => setGroupForm({ ...groupForm, name: v })} />
      </Modal>

      {/* 凭证编辑弹窗 */}
      <Modal title={itemForm?.id ? '编辑凭证' : '新增凭证'} visible={itemModal} width={640} onCancel={() => setItemModal(false)} onOk={saveItem}>
        {itemForm && (
          <Space vertical style={{ width: '100%' }}>
            <Input placeholder="名称（必填）" value={itemForm.name} onChange={(v) => setItemForm({ ...itemForm, name: v })} />
            <Select placeholder="分组" value={itemForm.groupId} onChange={(v) => setItemForm({ ...itemForm, groupId: v })} style={{ width: '100%' }}
              optionList={[{ value: null, label: '未分组' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
            <Input placeholder="账号/用户名" value={itemForm.account} onChange={(v) => setItemForm({ ...itemForm, account: v })} />
            <Space style={{ width: '100%' }}>
              <Input placeholder="密码（留空不修改）" value={itemForm.password} onChange={(v) => setItemForm({ ...itemForm, password: v })} style={{ flex: 1 }} />
              <Button icon={<IconRefresh />} onClick={() => { const p = genPassword(); setItemForm({ ...itemForm, password: p }); copyText(p) }}>生成</Button>
            </Space>
            <TextArea placeholder="备注" value={itemForm.note} onChange={(v) => setItemForm({ ...itemForm, note: v })} rows={2} />
            <div style={{ width: '100%' }}>
              <Text strong>自定义字段</Text>
              {itemForm.fields.map((f, i) => (
                <Space key={i} style={{ width: '100%', marginTop: 8 }}>
                  <Input placeholder="字段名，如 AppID" value={f.key} onChange={(v) => {
                    const fields = [...itemForm.fields]; fields[i].key = v; setItemForm({ ...itemForm, fields })
                  }} style={{ width: '45%' }} />
                  <Input placeholder="字段值，如 Secret" value={f.value} onChange={(v) => {
                    const fields = [...itemForm.fields]; fields[i].value = v; setItemForm({ ...itemForm, fields })
                  }} style={{ width: '45%' }} />
                  <Button size="small" type="danger" icon={<IconDelete />} onClick={() => {
                    const fields = itemForm.fields.filter((_, j) => j !== i)
                    setItemForm({ ...itemForm, fields: fields.length ? fields : [{ key: '', value: '' }] })
                  }} />
                </Space>
              ))}
              <Button size="small" icon={<IconPlus />} style={{ marginTop: 8 }}
                onClick={() => setItemForm({ ...itemForm, fields: [...itemForm.fields, { key: '', value: '' }] })}>添加字段</Button>
            </div>
          </Space>
        )}
      </Modal>

      {/* 查看弹窗 */}
      <Modal title={reveal?.name} visible={!!reveal} width={620} footer={null} onCancel={() => setReveal(null)}>
        {reveal && (
          <Space vertical align="start" style={{ width: '100%' }}>
            <Descriptions
              data={[
                { key: '账号', value: (
                  <Space>
                    <Text>{showPlain ? reveal.account : MASK}</Text>
                    <Button size="small" icon={showPlain ? <IconEyeClosed /> : <IconEyeOpened />} onClick={togglePlain} />
                    <Button size="small" icon={<IconCopy />} onClick={() => copyText(reveal.account)}>复制</Button>
                  </Space>
                ) },
                { key: '密码', value: (
                  <Space>
                    <Text>{showPlain ? reveal.password : MASK}</Text>
                    <Button size="small" icon={showPlain ? <IconEyeClosed /> : <IconEyeOpened />} onClick={togglePlain} />
                    <Button size="small" icon={<IconCopy />} onClick={() => copyText(reveal.password)}>复制</Button>
                  </Space>
                ) },
                { key: '备注', value: reveal.note || '—' },
                ...(reveal.fields || []).map((f) => ({ key: f.key, value: (
                  <Space>
                    <Text>{showPlain ? f.value : (f.value ? MASK : '')}</Text>
                    <Button size="small" icon={<IconCopy />} onClick={() => copyText(f.value)} />
                  </Space>
                ) }))
              ]}
              column={1}
            />
            {showPlain && <Text type="warning" size="small">明文将在 5 秒后自动隐藏</Text>}
            <div style={{ width: '100%' }}>
              <Title heading={6}>附件</Title>
              <Space wrap>
                {attachments.map((a) => (
                  <Tag key={a.id} color="blue" style={{ padding: '4px 10px' }}>
                    {a.originalName}
                    <Button size="small" theme="borderless" icon={<IconDownload />} onClick={() => onDownload(a)} />
                    <Popconfirm title="删除该附件？" onConfirm={async () => { await toolApi.deleteAttachment(a.id); loadAttachments(reveal.id) }}>
                      <Button size="small" theme="borderless" type="danger" icon={<IconDelete />} />
                    </Popconfirm>
                  </Tag>
                ))}
                {!attachments.length && <Text type="tertiary">暂无附件</Text>}
                <label style={{ cursor: 'pointer' }}>
                  <Button component="span" icon={<IconUpload />}>上传</Button>
                  <input type="file" hidden onChange={(e) => onUpload(e, reveal.id)} />
                </label>
              </Space>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}
