import { useEffect, useState } from 'react'
import { Button, Input, Modal, Select, Table, Tag, TextArea, Toast, Tooltip } from '@douyinfe/semi-ui'
import { IconDelete, IconEdit, IconPlus, IconSearch, IconRefresh } from '@douyinfe/semi-icons'
import { useAuth } from '../auth'
import { commentApi, recordApi } from '../api'

const YEARS = [2023, 2024, 2025, 2026]
const FIELD_CODES = ['F', 'K', 'AC', 'AD', 'AE', 'AF', 'C', 'E', 'H']
const HINTS = { F: ' 奖金/其他', K: ' 补差/未休假', AC: ' 其他奖金构成', AD: ' 年度奖金', AE: ' 年度个税', AF: ' 年度实发', C: ' 岗位工资', E: ' 奖金', H: ' 加班' }

export default function Comments() {
  const auth = useAuth()
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState({ year: null, fieldCode: null, keyword: '' })
  const [editVisible, setEditVisible] = useState(false)
  const [form, setForm] = useState({ id: null, month: null, recordId: null, fieldCode: 'AC', content: '' })
  const [saving, setSaving] = useState(false)
  const [monthOptions, setMonthOptions] = useState([])

  const load = async (p, s) => {
    setLoading(true)
    try {
      const data = await commentApi.page({
        page: p || page, size: s || size,
        year: query.year || undefined,
        fieldCode: query.fieldCode || undefined,
        keyword: query.keyword || undefined
      })
      setList(data.records)
      setTotal(data.total)
      setPage(p || page)
      if (s) setSize(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    recordApi.page({ page: 1, size: 100 }).then((data) => {
      setMonthOptions(data.records.map((r) => r.month.slice(0, 7)))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setForm({ id: null, month: null, recordId: null, fieldCode: 'AC', content: '' })
    setEditVisible(true)
  }

  const openEdit = (row) => {
    setForm({ id: row.id, month: row.month?.slice(0, 7), recordId: row.recordId, fieldCode: row.fieldCode, content: row.content })
    setEditVisible(true)
  }

  const save = async () => {
    if (!form.month || !form.fieldCode || !form.content.trim()) {
      Toast.warning('请填写月份、字段和内容')
      return
    }
    let recordId = form.recordId
    if (!recordId) {
      const data = await recordApi.page({ page: 1, size: 1, monthFrom: form.month, monthTo: form.month })
      if (!data.records.length) {
        Toast.error('该月份没有工资记录，请先录入工资')
        return
      }
      recordId = data.records[0].id
    }
    const payload = { recordId, fieldCode: form.fieldCode, content: form.content.trim() }
    setSaving(true)
    try {
      if (form.id) {
        await commentApi.update(form.id, payload)
        Toast.success('修改成功')
      } else {
        await commentApi.create(payload)
        Toast.success('新增成功')
      }
      setEditVisible(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = (row) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定删除该批注吗？',
      onOk: async () => {
        await commentApi.remove(row.id)
        Toast.success('已删除')
        load()
      }
    })
  }

  const columns = [
    { title: '月份', dataIndex: 'month', width: 110, render: (v) => v?.slice(0, 7) },
    { title: '字段', dataIndex: 'fieldCode', width: 90, render: (v) => <Tag color="orange" size="small">{v}</Tag> },
    { title: '作者', dataIndex: 'author', width: 100 },
    { title: '批注内容', dataIndex: 'content', width: 320, render: (v) => <Tooltip content={<pre className="comment-tip">{v}</pre>}><span style={{ cursor: 'pointer' }}>{v?.slice(0, 40)}{v?.length > 40 ? '…' : ''}</span></Tooltip> },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 },
    {
      title: '操作', width: 130, fixed: 'right', align: 'center',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {auth.canEdit && <Button size="small" type="primary" icon={<IconEdit />} onClick={() => openEdit(row)} />}
          {auth.canEdit && <Button size="small" type="danger" icon={<IconDelete />} onClick={() => remove(row)} />}
        </div>
      )
    }
  ]

  return (
    <div>
      <div className="page-card filter-bar">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Select placeholder="年份" value={query.year} onChange={(v) => setQuery({ ...query, year: v })} clearable
            optionList={YEARS.map((y) => ({ value: y, label: String(y) }))} style={{ width: 110 }} />
          <Select placeholder="字段" value={query.fieldCode} onChange={(v) => setQuery({ ...query, fieldCode: v })} clearable
            optionList={FIELD_CODES.map((f) => ({ value: f, label: `${f}${HINTS[f] || ''}` }))} style={{ width: 160 }} />
          <Input placeholder="关键词（如：高低温 / 未休假）" value={query.keyword}
            onChange={(v) => setQuery({ ...query, keyword: v })} onEnterPress={() => load(1)} style={{ width: 220 }} />
          <Button theme="solid" icon={<IconSearch />} onClick={() => load(1)}>查询</Button>
          <Button icon={<IconRefresh />} onClick={() => { setQuery({ year: null, fieldCode: null, keyword: '' }); setTimeout(() => load(1), 0) }}>重置</Button>
          {auth.canEdit && <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>新增批注</Button>}
        </div>
      </div>
      <div className="page-card">
        <Table
          columns={columns}
          dataSource={list}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            currentPage: page,
            pageSize: size,
            total,
            onPageChange: (p) => load(p),
            showSizeChanger: true,
            pageSizeOpts: [20, 50, 100, 500],
            onPageSizeChange: (s) => load(1, s)
          }}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={form.id ? '编辑批注' : '新增批注'}
        visible={editVisible}
        onOk={save}
        onCancel={() => setEditVisible(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        style={{ width: 560 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 80, textAlign: 'right', color: 'var(--semi-color-text-1)' }}>工资月份 *</span>
            <Select placeholder="选择月份" value={form.month} onChange={(v) => setForm({ ...form, month: v })}
              optionList={monthOptions.map((m) => ({ value: m, label: m }))} style={{ flex: 1 }} filter />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 80, textAlign: 'right', color: 'var(--semi-color-text-1)' }}>字段 *</span>
            <Select value={form.fieldCode} onChange={(v) => setForm({ ...form, fieldCode: v })}
              optionList={FIELD_CODES.map((f) => ({ value: f, label: `${f}${HINTS[f] || ''}` }))} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 80, textAlign: 'right', color: 'var(--semi-color-text-1)', paddingTop: 6 }}>内容 *</span>
            <TextArea
              placeholder="每行一条，如：饭贴+高低温：750"
              value={form.content}
              onChange={(v) => setForm({ ...form, content: v })}
              autosize={{ minRows: 4, maxRows: 10 }}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
