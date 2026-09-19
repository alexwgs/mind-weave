import { useEffect, useMemo, useState } from 'react'
import {
  Button, Col, Descriptions, Divider, Empty, Input, InputNumber,
  Modal, Row, Select, SideSheet, Spin, Switch, Table, Tag, Toast, Tooltip
} from '@douyinfe/semi-ui'
import {
  IconChevronDown, IconChevronRight, IconDelete, IconDownload, IconEdit,
  IconEyeOpened, IconPlus, IconSearch, IconRefresh
} from '@douyinfe/semi-icons'
import { useAuth } from '../auth'
import { exportApi, recordApi } from '../api'
import { downloadBlob, useIsDesktop } from '../hooks'
import { fieldComments, fmtMoney } from '../utils'
import CommentCell from '../components/CommentCell'

const YEARS = [2023, 2024, 2025, 2026]
const GRADES = ['A1', 'A2', 'A3', 'B1', 'B2', 'C']

const extraTotal = (row) => (Number(row?.otherBonus) || 0) + (Number(row?.annualBonusNet) || 0)

const GROUPS = [
  {
    key: 'income', label: '加项合计', totalKey: 'totalIncome', tint: '',
    fields: [
      { key: 'postSalary', label: '岗位工资' }, { key: 'regionAllowance', label: '地区补贴' },
      { key: 'bonus', label: '奖金' }, { key: 'otherIncome', label: '其他' },
      { key: 'postSubsidy', label: '岗位津贴' }, { key: 'overtimePay', label: '加班工资' },
      { key: 'housingSubsidy', label: '购房补贴' }, { key: 'workAllowance', label: '工作补贴' },
      { key: 'otherAdjust', label: '其他/补差' }
    ]
  },
  {
    key: 'deduction', label: '扣项合计', totalKey: 'totalDeduction', tint: 'g-deduction',
    fields: [
      { key: 'pensionPersonal', label: '养老保险' }, { key: 'unemploymentPersonal', label: '失业保险' },
      { key: 'medicalPersonal', label: '医疗保险' }, { key: 'housingFundPersonal', label: '住房公积金' },
      { key: 'annuityPersonal', label: '企业年金' }, { key: 'incomeTax', label: '个人所得税' }
    ]
  },
  {
    key: 'company', label: '公司合计', totalKey: 'companyTotal', tint: 'g-company',
    fields: [
      { key: 'pensionCompany', label: '养老保险' }, { key: 'unemploymentCompany', label: '失业保险' },
      { key: 'medicalCompany', label: '医疗保险' }, { key: 'injuryCompany', label: '工伤保险' },
      { key: 'maternityCompany', label: '生育保险' }, { key: 'housingFundCompany', label: '住房公积金' },
      { key: 'annuityCompany', label: '企业年金' }
    ]
  },
  {
    key: 'extra', label: '另发奖金', totalKey: 'extraTotal', tint: 'g-extra',
    compute: extraTotal,
    fields: [
      { key: 'otherBonus', label: '其他奖金' },
      { key: 'annualBonusNet', label: '年度实发' }
    ]
  }
]

const ALL_FIELDS = GROUPS.flatMap((g) => g.fields).map((f) => f.key)

function emptyForm() {
  const f = { year: null, month: null, grade: null }
  ALL_FIELDS.forEach((k) => { f[k] = null })
  return f
}

export default function Records() {
  const auth = useAuth()
  const isDesktop = useIsDesktop()
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(50)
  const [query, setQuery] = useState({ year: null, grade: null, hasComment: null, keyword: '', minNetPay: null, maxNetPay: null, sortField: null, sortOrder: null })
  const [expanded, setExpanded] = useState({ income: true, deduction: false, company: false, extra: false })

  const [detail, setDetail] = useState(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [monthOptions, setMonthOptions] = useState([])
  const [copyMonth, setCopyMonth] = useState(null)

  const load = async (p, s) => {
    const pageNo = p || page
    const pageSize = s || size
    setLoading(true)
    try {
      const data = await recordApi.page({
        page: pageNo, size: pageSize,
        year: query.year || undefined,
        grade: query.grade || undefined,
        hasComment: query.hasComment === null || query.hasComment === undefined ? undefined : query.hasComment,
        keyword: query.keyword || undefined,
        minNetPay: query.minNetPay === null ? undefined : query.minNetPay,
        maxNetPay: query.maxNetPay === null ? undefined : query.maxNetPay,
        sortField: query.sortField || undefined,
        sortOrder: query.sortOrder || undefined
      })
      setRows(data.records)
      setTotal(data.total)
      setPage(pageNo)
      setSize(pageSize)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = () => {
    setQuery({ year: null, grade: null, hasComment: null, keyword: '', minNetPay: null, maxNetPay: null, sortField: null, sortOrder: null })
    setTimeout(() => load(1), 0)
  }

  const exportXlsx = async () => {
    setExporting(true)
    try {
      const blob = await exportApi.download({
        year: query.year || undefined,
        grade: query.grade || undefined,
        hasComment: query.hasComment === null || query.hasComment === undefined ? undefined : query.hasComment,
        keyword: query.keyword || undefined,
        minNetPay: query.minNetPay === null ? undefined : query.minNetPay,
        maxNetPay: query.maxNetPay === null ? undefined : query.maxNetPay
      })
      downloadBlob(blob, '工资记录.xlsx')
      Toast.success('导出成功')
    } finally {
      setExporting(false)
    }
  }

  const openDetail = async (row) => {
    const d = await recordApi.detail(row.id)
    setDetail(d)
    setDetailVisible(true)
  }

  const openCreate = async () => {
    setForm(emptyForm())
    setCopyMonth(null)
    if (!monthOptions.length) {
      const data = await recordApi.page({ page: 1, size: 100 })
      setMonthOptions(data.records.map((r) => ({ id: r.id, month: r.month })))
    }
    setEditVisible(true)
  }

  const openEdit = (row) => {
    const f = emptyForm()
    Object.assign(f, { year: Number(row.month.slice(0, 4)), month: Number(row.month.slice(5, 7)), id: row.id })
    ALL_FIELDS.forEach((k) => { f[k] = row[k] === null || row[k] === undefined ? null : Number(row[k]) })
    f.grade = row.grade
    setForm(f)
    setEditVisible(true)
  }

  const fillFromHistory = async () => {
    if (!copyMonth) return
    const d = await recordApi.detail(copyMonth)
    setForm((prev) => {
      const next = { ...prev }
      ALL_FIELDS.forEach((k) => { next[k] = d[k] === null || d[k] === undefined ? null : Number(d[k]) })
      next.grade = d.grade || null
      return next
    })
    Toast.success(`已填充 ${d.month.slice(0, 7)} 的数据，请确认月份后保存`)
  }

  const save = async () => {
    if (!form.year || !form.month) {
      Toast.warning('请选择月份')
      return
    }
    const payload = { month: `${form.year}-${String(form.month).padStart(2, '0')}-01`, grade: form.grade || null }
    ALL_FIELDS.forEach((k) => { payload[k] = form[k] === null || form[k] === '' ? null : Number(form[k]) })
    setSaving(true)
    try {
      if (form.id) {
        await recordApi.update(form.id, payload)
        Toast.success('修改成功')
      } else {
        await recordApi.create(payload)
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
      content: `确定删除 ${row.month.slice(0, 7)} 的工资记录吗？删除后不可恢复。`,
      onOk: async () => {
        await recordApi.remove(row.id)
        Toast.success('已删除')
        load()
      }
    })
  }

  const toggleGroup = (key) => setExpanded((e) => ({ ...e, [key]: !e[key] }))

  const SORT_FIELDS = ['postSalary', 'bonus', 'overtimePay', 'otherAdjust', 'totalIncome', 'totalDeduction', 'netPay', 'totalSalary', 'companyTotal', 'otherBonus', 'annualBonusNet', 'extraTotal']

  const sortable = (dataIndex) => ({
    sorter: true,
    sortOrder: query.sortField === dataIndex ? (query.sortOrder === 'asc' ? 'ascend' : 'descend') : undefined
  })

  const handleTableChange = (data) => {
    const s = Array.isArray(data?.sorter) ? data.sorter[0] : data?.sorter
    if (!s || !s.dataIndex) return
    setQuery((prev) => ({ ...prev, sortField: s.dataIndex, sortOrder: s.sortOrder === 'descend' ? 'desc' : 'asc' }))
    setTimeout(() => load(1), 0)
  }

  const totals = useMemo(() => {
    const sum = (keys) => keys.reduce((s, k) => s + (Number(form[k]) || 0), 0)
    const income = sum(GROUPS[0].fields.map((f) => f.key))
    const deduction = sum(GROUPS[1].fields.map((f) => f.key))
    const company = sum(GROUPS[2].fields.map((f) => f.key))
    return { income, deduction, net: income - deduction, company }
  }, [form])

  const columns = useMemo(() => {
    const base = [
      { title: '月份', dataIndex: 'month', width: 96, fixed: 'left', ...sortable('month'), render: (v) => v?.slice(0, 7) },
      {
        title: '考核', dataIndex: 'grade', width: 62, fixed: 'left', ...sortable('grade'),
        render: (v, row) => <CommentCell value={v} comments={fieldComments(row, 'grade')} />
      }
    ]
    const groupCols = GROUPS.filter((g) => g.key !== 'extra').flatMap((g) => {
      const totalCol = {
        title: g.label, dataIndex: g.totalKey, width: 106, align: 'right', className: g.tint, ...sortable(g.totalKey),
        render: (v, row) => <CommentCell money value={v} comments={fieldComments(row, g.totalKey)} />
      }
      const fieldCols = expanded[g.key]
        ? g.fields.map((f) => ({
          title: f.label, dataIndex: f.key, width: 96, align: 'right', className: g.tint,
          ...(SORT_FIELDS.includes(f.key) ? sortable(f.key) : {}),
          render: (v, row) => <CommentCell money value={v} comments={fieldComments(row, f.key)} />
        }))
        : []
      return [totalCol, ...fieldCols]
    })
    const extraGroup = GROUPS.find((g) => g.key === 'extra')
    const extraCols = [
      {
        title: extraGroup.label, dataIndex: 'extraTotal', width: 106, align: 'right', className: 'g-extra', ...sortable('extraTotal'),
        render: (v, row) => <CommentCell money value={extraGroup.compute(row)} />
      },
      ...(expanded.extra
        ? extraGroup.fields.map((f) => ({
          title: f.label, dataIndex: f.key, width: 110, align: 'right', className: 'g-extra',
          ...(SORT_FIELDS.includes(f.key) ? sortable(f.key) : {}),
          render: (v, row) => <CommentCell money value={v} comments={fieldComments(row, f.key)} />
        }))
        : [])
    ]
    const tail = [
      {
        title: '实发金额', dataIndex: 'netPay', width: 106, align: 'right', ...sortable('netPay'),
        render: (v, row) => <CommentCell money value={v} comments={fieldComments(row, 'netPay')} />
      },
      ...extraCols,
      {
        title: '总薪资', dataIndex: 'totalSalary', width: 106, align: 'right', ...sortable('totalSalary'),
        render: (v, row) => <CommentCell money value={v} comments={fieldComments(row, 'totalSalary')} />
      },
      {
        title: '批注', dataIndex: 'commentCount', width: 72, align: 'center',
        render: (v) => (v ? <Tag color="orange">{v}</Tag> : <span style={{ color: '#c2c8d1' }}>—</span>)
      },
      {
        title: '操作', width: 128, fixed: 'right', align: 'center',
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            <Tooltip content="查看详情" position="top"><Button size="small" icon={<IconEyeOpened />} onClick={() => openDetail(row)} /></Tooltip>
            {auth.can('records.edit') && (
              <Tooltip content="编辑" position="top"><Button size="small" icon={<IconEdit />} onClick={() => openEdit(row)} /></Tooltip>
            )}
            {auth.can('records.delete') && (
              <Tooltip content="删除" position="top"><Button size="small" type="danger" icon={<IconDelete />} onClick={() => remove(row)} /></Tooltip>
            )}
          </div>
        )
      }
    ]
    return [...base, ...groupCols, ...tail]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, auth, query])

  const toolbar = (
    <div className="page-card filter-bar">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <Select placeholder="年份" value={query.year} onChange={(v) => setQuery({ ...query, year: v })} clearable
          optionList={YEARS.map((y) => ({ value: y, label: String(y) }))} style={{ width: 110 }} />
        <Select placeholder="考核等级" value={query.grade} onChange={(v) => setQuery({ ...query, grade: v })} clearable
          optionList={GRADES.map((g) => ({ value: g, label: g }))} style={{ width: 110 }} />
        <Select placeholder="批注" value={query.hasComment} onChange={(v) => setQuery({ ...query, hasComment: v })} clearable
          optionList={[{ value: true, label: '有批注' }, { value: false, label: '无批注' }]} style={{ width: 110 }} />
        <Input placeholder="批注关键词（如：高低温）" value={query.keyword} onChange={(v) => setQuery({ ...query, keyword: v })} style={{ width: 200 }} />
        <InputNumber placeholder="实发最低" value={query.minNetPay} onChange={(v) => setQuery({ ...query, minNetPay: v })} style={{ width: 110 }} />
        <span style={{ color: 'var(--semi-color-text-2)' }}>~</span>
        <InputNumber placeholder="实发最高" value={query.maxNetPay} onChange={(v) => setQuery({ ...query, maxNetPay: v })} style={{ width: 110 }} />
        <Button theme="solid" icon={<IconSearch />} onClick={() => load(1)}>查询</Button>
        <Button icon={<IconRefresh />} onClick={reset}>重置</Button>
        {auth.can('records.export') && <Button icon={<IconDownload />} loading={exporting} onClick={exportXlsx}>导出</Button>}
        {auth.can('records.create') && <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>新增记录</Button>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginTop: 12 }}>
        <span style={{ fontWeight: 600 }}>组合展示：</span>
        {GROUPS.map((g) => (
          <label key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Switch size="small" checked={expanded[g.key]} onChange={() => toggleGroup(g.key)} />
            {g.label}{expanded[g.key] ? '展开' : '收起'}
          </label>
        ))}
        <span style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>鼠标移到带<span style={{ color: '#e6a23c', fontWeight: 700 }}>·</span>标记的数据上可查看批注</span>
      </div>
    </div>
  )

  return (
    <div>
      {toolbar}
      <div className="page-card">
        {isDesktop ? (
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="id"
            loading={loading}
            size="small"
            onChange={handleTableChange}
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
        ) : (
          <Spin spinning={loading}>
            <div style={{ minHeight: 200 }}>
              {rows.map((row) => (
                <div className="mobile-card" key={row.id}>
                  <div className="mobile-head">
                    <span className="mobile-month">{row.month.slice(0, 7)}</span>
                    <Tag size="small">{row.grade || '—'}</Tag>
                    <span className="mobile-net">实发 <b>{fmtMoney(row.netPay)}</b></span>
                    {row.commentCount ? <Tag color="orange" size="small">{row.commentCount} 批注</Tag> : null}
                  </div>
                  {GROUPS.map((g) => (
                    <div className={`mobile-group ${g.tint}`} key={g.key}>
                      <div className="mobile-group-head" onClick={() => toggleGroup(g.key)}>
                        <span>{g.label}（{expanded[g.key] ? '收起' : '展开'}）</span>
                        {expanded[g.key] ? <IconChevronDown /> : <IconChevronRight />}
                      </div>
                      {expanded[g.key] ? (
                        <div className="mobile-fields">
                          {g.fields.map((f) => (
                            <div className="mobile-field" key={f.key}>
                              <span className="mobile-field-label">{f.label}</span>
                              <CommentCell money value={row[f.key]} comments={fieldComments(row, f.key)} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mobile-total">
                          <span>{g.label}合计</span>
                          <CommentCell money value={g.compute ? g.compute(row) : row[g.totalKey]}
                            comments={g.compute ? [] : fieldComments(row, g.totalKey)} />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="mobile-normal">
                    <div className="mobile-field">
                      <span className="mobile-field-label">总薪资</span>
                      <CommentCell money value={row.totalSalary} comments={fieldComments(row, 'totalSalary')} />
                    </div>
                  </div>
                  <div className="mobile-actions">
                    <Button size="small" icon={<IconEyeOpened />} onClick={() => openDetail(row)} />
                    {auth.can('records.edit') && <Button size="small" type="primary" icon={<IconEdit />} onClick={() => openEdit(row)} />}
                    {auth.can('records.delete') && <Button size="small" type="danger" icon={<IconDelete />} onClick={() => remove(row)} />}
                  </div>
                </div>
              ))}
              {!rows.length && !loading && <Empty description="暂无记录" />}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <div>
                <span style={{ marginRight: 12, color: 'var(--semi-color-text-2)' }}>共 {total} 条</span>
                <Button size="small" disabled={page <= 1} onClick={() => load(page - 1)}>上一页</Button>
                <span style={{ margin: '0 10px' }}>{page}</span>
                <Button size="small" disabled={page * size >= total} onClick={() => load(page + 1)}>下一页</Button>
              </div>
            </div>
          </Spin>
        )}
      </div>

      <SideSheet
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        title={detail ? `${detail.month.slice(0, 7)} 工资详情` : ''}
        width="min(680px, 94vw)"
        footer={null}
      >
        {detail && (
          <>
            <div className="detail-section-title">基础信息</div>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">月份</span><span className="detail-value">{detail.month.slice(0, 7)}</span></div>
              <div className="detail-item"><span className="detail-label">考核等级</span><span className="detail-value">{detail.grade || '—'}</span></div>
              <div className="detail-item g-pay"><span className="detail-label">加项合计</span><span className="detail-value"><CommentCell money value={detail.totalIncome} comments={fieldComments(detail, 'totalIncome')} /></span></div>
              <div className="detail-item g-deduction"><span className="detail-label">扣项合计</span><span className="detail-value"><CommentCell money value={detail.totalDeduction} comments={fieldComments(detail, 'totalDeduction')} /></span></div>
              <div className="detail-item g-pay"><span className="detail-label">实发金额</span><span className="detail-value"><CommentCell money value={detail.netPay} comments={fieldComments(detail, 'netPay')} /></span></div>
              <div className="detail-item g-extra"><span className="detail-label">另发奖金</span><span className="detail-value"><CommentCell money value={extraTotal(detail)} /></span></div>
              <div className="detail-item g-pay"><span className="detail-label">总薪资</span><span className="detail-value"><CommentCell money value={detail.totalSalary} comments={fieldComments(detail, 'totalSalary')} /></span></div>
              <div className="detail-item g-company"><span className="detail-label">公司合计</span><span className="detail-value"><CommentCell money value={detail.companyTotal} comments={fieldComments(detail, 'companyTotal')} /></span></div>
            </div>
            {GROUPS.map((g) => (
              <div key={g.key}>
                <div className="detail-section-title">{g.label}明细</div>
                <div className="detail-grid">
                  {g.fields.map((f) => (
                    <div className={`detail-item ${g.tint}`} key={f.key}>
                      <span className="detail-label">{f.label}</span>
                      <span className="detail-value"><CommentCell money value={detail[f.key]} comments={fieldComments(detail, f.key)} /></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="detail-section-title">批注（{detail.comments?.length || 0}）</div>
            {detail.comments?.length ? (
              detail.comments.map((c) => (
                <div key={c.id} style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10, background: 'var(--semi-color-fill-0)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <Tag color="orange" size="small">{c.fieldCode}</Tag>
                    <span style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>{c.author}</span>
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}>{c.content}</pre>
                </div>
              ))
            ) : (
              <Empty description="该月无批注" />
            )}
          </>
        )}
      </SideSheet>

      <Modal
        title={form.id ? '编辑工资记录' : '新增工资记录'}
        visible={editVisible}
        onOk={save}
        onCancel={() => setEditVisible(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        style={{ width: 780, maxWidth: '94vw' }}
      >
        {!form.id && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <span style={{ width: 100, textAlign: 'right', color: 'var(--semi-color-text-1)', fontSize: 14 }}>复制历史月份</span>
            <Select
              placeholder="选择要复制的历史月份"
              value={copyMonth}
              onChange={setCopyMonth}
              optionList={monthOptions.map((m) => ({ value: m.id, label: m.month.slice(0, 7) }))}
              style={{ width: 220 }}
              filter
            />
            <Button disabled={!copyMonth} onClick={fillFromHistory}>填充数据</Button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <span style={{ width: 100, textAlign: 'right', color: 'var(--semi-color-text-1)', fontSize: 14 }}>月份 *</span>
          <Select value={form.year} onChange={(v) => setForm({ ...form, year: v })} placeholder="年"
            optionList={YEARS.map((y) => ({ value: y, label: String(y) }))} style={{ width: 100 }} />
          <Select value={form.month} onChange={(v) => setForm({ ...form, month: v })} placeholder="月"
            optionList={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1} 月` }))} style={{ width: 90 }} />
          <span style={{ color: 'var(--semi-color-text-2)' }}>考核等级</span>
          <Select value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} clearable placeholder="选择"
            optionList={GRADES.map((g) => ({ value: g, label: g }))} style={{ width: 100 }} />
        </div>
        {GROUPS.map((g) => (
          <div key={g.key}>
            <Divider align="left">{g.label}</Divider>
            <Row gutter={[12, 0]}>
              {g.fields.map((f) => (
                <Col xs={12} sm={8} key={f.key} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 74, textAlign: 'right', color: 'var(--semi-color-text-1)', fontSize: 13, flexShrink: 0 }}>{f.label}</span>
                    <InputNumber value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} style={{ flex: 1 }} />
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        ))}
        <div style={{ marginTop: 6, background: 'var(--semi-color-fill-0)', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
          加项合计 {fmtMoney(totals.income)} ｜ 扣项合计 {fmtMoney(totals.deduction)} ｜ 实发 {fmtMoney(totals.net)} ｜ 公司合计 {fmtMoney(totals.company)}
        </div>
      </Modal>
    </div>
  )
}
