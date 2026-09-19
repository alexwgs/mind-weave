import { useEffect, useState } from 'react'
import {
  Button, Checkbox, DatePicker, Empty, Input, Modal, Pagination, Popconfirm, Select, Space, Spin, Tag, TimePicker,
  Toast, Tooltip, Typography
} from '@douyinfe/semi-ui'
import {
  IconBellStroked, IconBolt, IconDelete, IconEdit, IconPlus, IconRefresh, IconSearch
} from '@douyinfe/semi-icons'
import dayjs from 'dayjs'
import { toolApi } from '../api'
import { useAuth } from '../auth'
import {
  buildCron, fmtRule, isDone, matchesTimeFilter, parseCronRule, reminderState, WEEK_DAYS
} from '../utils/todo'
import { fmtDateTime } from '../utils/datetime'
import '../todos.css'

const { Text } = Typography

const PRIORITY = {
  HIGH: { label: '高', color: 'red' },
  MEDIUM: { label: '中', color: 'orange' },
  LOW: { label: '低', color: 'grey' }
}

const STATUS_FILTERS = [
  { value: 'active', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'overdue', label: '已逾期' },
  { value: 'today', label: '今天到期' },
  { value: 'upcoming', label: '未来 7 天' },
  { value: 'all', label: '全部' }
]

const RECUR_TYPES = [
  { value: 'NONE', label: '不循环' },
  { value: 'DAILY', label: '每天' },
  { value: 'WEEKLY', label: '每周' },
  { value: 'MONTHLY', label: '每月' },
  { value: 'CUSTOM', label: '自定义 Cron' }
]
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 日` }))
const PUSH_RESULT = { SENT: '最近一次推送成功', PARTIAL: '部分渠道成功', FAILED: '最近一次推送失败', UNCONFIGURED: '尚未配置推送渠道' }

const emptyForm = () => ({
  id: null,
  title: '',
  project: '',
  priority: 'MEDIUM',
  dueTime: null,
  hasRemind: false,
  remindTime: null,
  remindNote: '',
  recurType: 'NONE',
  recurDays: ['MON'],
  recurTime: '09:00',
  recurRaw: '',
  subs: []
})

/** 提交给后端的 LocalDateTime 不带时区，直接按本地时间格式化 */
const toPlain = (v) => (v ? dayjs(v).format('YYYY-MM-DDTHH:mm:ss') : null)

/**
 * Semi 的 DatePicker/TimePicker 只接受 Date 对象、ISO 字符串或时间戳，
 * 传 dayjs 对象会抛"defaultValue should be valid Date object/timestamp or string"，
 * 所以进出 picker 的值统一用原生 Date。
 */
const toDate = (v) => (v ? dayjs(v).toDate() : null)

/** 把 "HH:mm" 变成 TimePicker 能接受的合法日期对象（项目里没有注册 dayjs 的 customParseFormat 插件） */
const timeToDate = (value) => {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(value || '').trim())
  if (!m) return undefined
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return undefined
  return dayjs().hour(hour).minute(minute).second(0).millisecond(0).toDate()
}

/** 把循环规则拆成表单能表达的形状；表达不了的原始表达式原样保留 */
const formFromTodo = (t) => {
  const base = emptyForm()
  const parsed = parseCronRule(t.recurRule)
  return {
    ...base,
    id: t.id,
    title: t.title || '',
    project: t.project || '',
    priority: t.priority || 'MEDIUM',
    dueTime: toDate(t.dueTime),
    hasRemind: Boolean(t.remindTime),
    remindTime: toDate(t.remindTime),
    remindNote: t.remindNote || '',
    recurType: t.recurRule ? parsed.type : 'NONE',
    recurDays: parsed.days?.length ? parsed.days : ['MON'],
    recurTime: parsed.time || '09:00',
    recurRaw: t.recurRule || '',
    subs: (t.subs || []).map((s) => ({ id: s.id, title: s.title, done: Number(s.done) === 1 }))
  }
}

export default function Todos() {
  const auth = useAuth()
  const canCreate = auth.can('todo.create')
  const canEdit = auth.can('todo.edit')
  const canDelete = auth.can('todo.delete')

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [loading, setLoading] = useState(true)

  const [status, setStatus] = useState('active')
  const [priority, setPriority] = useState(null)
  const [project, setProject] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const [projects, setProjects] = useState([])

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [summary, setSummary] = useState({ active: 0, today: 0, overdue: 0, completed: 0, withReminder: 0 })
  const [scheduler, setScheduler] = useState(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)

  const load = async (p = page, s = size, opt = {}) => {
    setLoading(true)
    try {
      const st = opt.status ?? status
      const data = await toolApi.todos({
        page: p,
        size: s,
        status: st === 'all' ? undefined : st,
        project: opt.project ?? project ?? undefined,
        priority: opt.priority ?? priority ?? undefined,
        keyword: (opt.keyword ?? keyword) || undefined
      })
      setRows(data.records || [])
      setTotal(data.total || 0)
      setPage(p)
      setSize(s)
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    try {
      setProjects(await toolApi.todoProjects())
    } catch {
      // 项目列表只是筛选项，取不到也不该挡住页面
    }
  }

  const loadMeta = async () => {
    const [nextSummary, nextScheduler] = await Promise.all([
      toolApi.todoSummary().catch(() => null),
      toolApi.todoSchedulerStatus().catch(() => null)
    ])
    if (nextSummary) setSummary(nextSummary)
    if (nextScheduler) setScheduler(nextScheduler)
  }

  useEffect(() => { load(1, size); loadMeta() }, []) // eslint-disable-line
  useEffect(() => { loadProjects() }, [])

  const shown = rows
  const stats = { ...summary, total }

  const openCreate = () => {
    setForm(emptyForm())
    setModal(true)
  }

  const openEdit = (t) => {
    setForm(formFromTodo(t))
    setModal(true)
  }

  const patch = (next) => setForm((f) => ({ ...f, ...next }))

  const buildRecurRule = () => {
    if (form.recurType === 'NONE') return null
    if (form.recurType === 'CUSTOM') return form.recurRaw.trim() || null
    return buildCron({ type: form.recurType, days: form.recurDays, time: form.recurTime })
  }

  const changeRecurType = (value) => {
    if (value === 'WEEKLY') patch({ recurType: value, recurDays: ['MON'] })
    else if (value === 'MONTHLY') patch({ recurType: value, recurDays: [String(dayjs(form.dueTime || undefined).date())] })
    else patch({ recurType: value })
  }

  const applyDuePreset = (kind) => {
    if (kind === 'clear') return patch({ dueTime: null, hasRemind: false, remindTime: null })
    let value = kind === 'tomorrow' ? dayjs().add(1, 'day').hour(9).minute(0) : dayjs().hour(18).minute(0)
    if (kind === 'today' && !value.isAfter(dayjs())) value = value.add(1, 'day')
    patch({ dueTime: value.toDate() })
  }

  const applyReminderOffset = (minutes) => {
    if (!form.dueTime) return Toast.warning('请先设置截止时间')
    patch({ hasRemind: true, remindTime: dayjs(form.dueTime).subtract(minutes, 'minute').toDate() })
  }

  const save = async () => {
    if (!form.title.trim()) {
      Toast.error('请先写下这件事的标题')
      return
    }
    const rule = buildRecurRule()
    if (form.recurType !== 'NONE' && !rule) {
      Toast.error(form.recurType === 'CUSTOM' ? '请填写有效的六段 Cron 表达式' : '请选择循环的星期或时间')
      return
    }
    if (form.hasRemind && form.remindTime && form.dueTime && dayjs(form.remindTime).isAfter(dayjs(form.dueTime))) {
      Toast.error('提醒时间不能晚于截止时间')
      return
    }
    const payload = {
      title: form.title.trim(),
      project: form.project.trim() || null,
      priority: form.priority,
      dueTime: toPlain(form.dueTime),
      remindTime: form.hasRemind ? toPlain(form.remindTime) : null,
      remindNote: form.hasRemind ? (form.remindNote.trim() || null) : null,
      recurRule: rule,
      subs: form.subs
        .filter((s) => s.title.trim())
        .map((s) => ({ id: s.id, title: s.title.trim(), done: s.done ? 1 : 0 }))
    }
    setSaving(true)
    try {
      if (form.id) {
        // 编辑时后端用 done 字段控制完成状态，这里原样带回不改变它
        await toolApi.updateTodo(form.id, payload)
        Toast.success('已保存')
      } else {
        await toolApi.createTodo(payload)
        Toast.success('已添加')
      }
      setModal(false)
      await Promise.all([load(), loadProjects(), loadMeta()])
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (t) => {
    setBusyId(t.id)
    try {
      const updated = await toolApi.toggleTodo(t.id)
      const leavesFilter = (status === 'active' && isDone(updated)) || (status === 'done' && !isDone(updated))
        || (['overdue', 'today', 'upcoming'].includes(status) && isDone(updated))
      setRows((current) => leavesFilter ? current.filter((row) => row.id !== t.id) : current.map((row) => row.id === t.id ? updated : row))
      if (leavesFilter) setTotal((value) => Math.max(0, value - 1))
      await loadMeta()
    } finally {
      setBusyId(null)
    }
  }

  const toggleSub = async (todoId, subId) => {
    setBusyId(todoId)
    try {
      const updated = await toolApi.toggleSub(todoId, subId)
      setRows((current) => current.map((row) => row.id === todoId
        ? { ...row, subs: (row.subs || []).map((sub) => sub.id === subId ? updated : sub) }
        : row))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id) => {
    await toolApi.deleteTodo(id)
    Toast.success('已删除')
    setRows((current) => current.filter((row) => row.id !== id))
    setTotal((value) => Math.max(0, value - 1))
    await Promise.all([load(rows.length === 1 && page > 1 ? page - 1 : page), loadProjects(), loadMeta()])
  }

  const quickAdd = async () => {
    const title = quickTitle.trim()
    if (!title) return Toast.warning('先写下要做的事')
    setQuickSaving(true)
    try {
      await toolApi.createTodo({ title, priority: 'MEDIUM', project: null, dueTime: null, remindTime: null, remindNote: null, recurRule: null, subs: [] })
      setQuickTitle('')
      Toast.success('已放入待办清单')
      await Promise.all([load(1, size, { status }), loadMeta()])
    } finally {
      setQuickSaving(false)
    }
  }

  const submitSearch = () => {
    setKeyword(draft.trim())
    load(1, size, { keyword: draft.trim() })
  }

  const resetFilters = () => {
    setStatus('active')
    setPriority(null)
    setProject(null)
    setKeyword('')
    setDraft('')
    load(1, size, { status: 'active', priority: null, project: null, keyword: '' })
  }

  const subProgress = (t) => {
    const subs = t.subs || []
    if (!subs.length) return null
    const done = subs.filter((s) => Number(s.done) === 1).length
    return `${done}/${subs.length}`
  }

  return (
    <div className="todos-page">
      <div className="workspace-page-heading">
        <div>
          <h1>日程待办<span className="heading-leaf">✿</span></h1>
          <p>把想做的事写下来，剩下的交给提醒。</p>
        </div>
        <Space>
          <Button icon={<IconRefresh />} onClick={() => { load(); loadProjects(); loadMeta() }}>刷新</Button>
          {canCreate && <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>新建待办</Button>}
        </Space>
      </div>

      <div className="todos-stats">
        <div className="todos-stat">
          <span className="stat-value">{stats.active}</span>
          <span>全部进行中</span>
        </div>
        <div className="todos-stat">
          <span className="stat-value">{stats.today}</span>
          <span>今天到期</span>
        </div>
        <div className="todos-stat is-alert">
          <span className="stat-value">{stats.overdue}</span>
          <span>已逾期</span>
        </div>
        <div className="todos-stat">
          <span className="stat-value">{stats.total}</span>
          <span>符合当前筛选</span>
        </div>
      </div>

      <div className={`todos-push-status${scheduler?.deliveryReady ? ' is-ready' : ' is-warning'}`}>
        <span className="todos-push-icon"><IconBellStroked /></span>
        <div>
          <strong>{scheduler?.deliveryReady ? '定时推送已就绪' : '定时任务运行中，但还没有可用推送渠道'}</strong>
          <p>
            {scheduler?.deliveryReady
              ? `${(scheduler.channels || []).map((channel) => channel === 'WECHAT' ? '微信订阅消息' : 'Bark').join(' + ')} · 每 ${scheduler.scanIntervalSeconds || 30} 秒扫描`
              : '请在系统设置中配置 Bark，或在微信小程序中绑定并授权订阅消息。'}
            {scheduler?.nextReminderAt ? ` · 下一次 ${scheduler.nextReminderAt.slice(5, 16)}` : ''}
          </p>
        </div>
        <span className="todos-push-result">{PUSH_RESULT[scheduler?.lastResult] || (scheduler?.lastRunAt ? `最近扫描 ${scheduler.lastRunAt.slice(5, 16)}` : '等待首次扫描')}</span>
      </div>

      {canCreate && <div className="todos-quick-add">
        <span className="quick-bolt"><IconBolt /></span>
        <Input value={quickTitle} onChange={setQuickTitle} onEnterPress={quickAdd} maxLength={200} placeholder="快速记下一件事，回车即可添加…" />
        <Button theme="solid" type="primary" loading={quickSaving} disabled={!quickTitle.trim()} onClick={quickAdd}>加入清单</Button>
      </div>}

      <div className="page-card todos-filter">
        <Input
          prefix={<IconSearch />}
          placeholder="搜索标题…"
          value={draft}
          onChange={setDraft}
          onEnterPress={submitSearch}
          style={{ width: 220 }}
        />
        <Select
          value={status}
          onChange={(v) => { setStatus(v); load(1, size, { status: v }) }}
          optionList={STATUS_FILTERS}
          style={{ width: 140 }}
        />
        <Select
          value={priority}
          onChange={(v) => { setPriority(v); load(1, size, { priority: v }) }}
          optionList={Object.entries(PRIORITY).map(([value, p]) => ({ value, label: `优先级：${p.label}` }))}
          placeholder="全部优先级"
          showClear
          style={{ width: 160 }}
        />
        <Select
          value={project}
          onChange={(v) => { setProject(v); load(1, size, { project: v }) }}
          optionList={projects.map((p) => ({ value: p, label: p }))}
          placeholder="全部项目"
          showClear
          style={{ width: 170 }}
        />
        <Button onClick={submitSearch}>搜索</Button>
        <Button theme="borderless" onClick={resetFilters}>重置</Button>
      </div>

      <div className="page-card todos-list-card">
        {loading ? (
          <div className="todos-loading"><Spin size="large" tip="正在整理待办" /></div>
        ) : shown.length === 0 ? (
          <Empty
            description={
              status === 'done' ? '还没有完成的待办'
                : keyword || project || priority ? '没有符合筛选条件的待办'
                  : '此刻没有待办，给自己一点留白'
            }
            style={{ padding: '60px 0' }}
          >
            {canCreate && !keyword && !project && !priority && (
              <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>新建待办</Button>
            )}
          </Empty>
        ) : (
          <ul className="todos-list">
            {shown.map((t) => {
              const done = isDone(t)
              const overdue = matchesTimeFilter(t, 'overdue')
              const prog = subProgress(t)
              const remind = reminderState(t)
              const project = t.project
              return (
                <li key={t.id} className={`todos-row${done ? ' is-done' : ''}`}>
                  <Checkbox
                    checked={done}
                    disabled={!canEdit || busyId === t.id}
                    onChange={() => toggle(t)}
                    aria-label={done ? `取消完成 ${t.title}` : `完成 ${t.title}`}
                  />
                  <div className="todos-row-main">
                    <div className="todos-row-title">
                      <span className={`priority-flag priority-${t.priority || 'LOW'}`} title={`优先级：${(PRIORITY[t.priority] || PRIORITY.LOW).label}`} />
                      <strong>{t.title}</strong>
                      {project && <span className="todos-project">{project}</span>}
                    </div>
                    <div className="todos-row-meta">
                      <span className={overdue ? 'is-overdue' : ''}>
                        {t.dueTime ? `截止 ${fmtDateTime(t.dueTime).slice(0, 16)}${overdue ? ' · 已逾期' : ''}` : '未设置截止时间'}
                      </span>
                      {remind && (
                        <span className={`remind-chip tone-${remind.tone}`}>
                          {remind.label}{remind.detail ? ` · ${remind.detail}` : ''}
                        </span>
                      )}
                      {prog && <span>子任务 {prog}</span>}
                      {t.updatedAt && <span className="is-quiet">更新于 {fmtDateTime(t.updatedAt).slice(0, 16)}</span>}
                    </div>
                    {(t.subs || []).length > 0 && (
                      <div className="todos-subs">
                        {(t.subs || []).map((s) => (
                          <label key={s.id} className={`todos-sub${Number(s.done) === 1 ? ' is-done' : ''}`}>
                            <Checkbox
                              checked={Number(s.done) === 1}
                              disabled={!canEdit || busyId === t.id}
                              onChange={() => toggleSub(t.id, s.id)}
                            />
                            <span>{s.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <Space className="todos-row-actions">
                    {canEdit && <Tooltip content="编辑"><Button size="small" icon={<IconEdit />} onClick={() => openEdit(t)} /></Tooltip>}
                    {canDelete && (
                      <Popconfirm title="确定删除这条待办？" onConfirm={() => remove(t.id)}>
                        <Button size="small" type="danger" icon={<IconDelete />} />
                      </Popconfirm>
                    )}
                  </Space>
                </li>
              )
            })}
          </ul>
        )}

        {!loading && total > size && (
          <div className="todos-pager">
            <Pagination
              currentPage={page}
              pageSize={size}
              total={total}
              showSizeChanger
              pageSizeOpts={[20, 50, 100]}
              onPageChange={(p) => load(p, size)}
              onPageSizeChange={(s) => load(1, s)}
            />
          </div>
        )}
      </div>

      <Modal
        title={form.id ? '编辑待办' : '新建待办'}
        visible={modal}
        onCancel={() => setModal(false)}
        onOk={save}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width="min(660px, calc(100vw - 24px))"
        keepDOM={false}
      >
        <div className="todos-form">
          <label className="todos-field">
            <span>标题</span>
            <Input
              value={form.title}
              onChange={(v) => patch({ title: v })}
              placeholder="要做的这件事是什么？"
              autoFocus
              maxLength={200}
            />
          </label>

          <div className="todos-field-row">
            <label className="todos-field">
              <span>项目 / 分组</span>
              <Input
                value={form.project}
                onChange={(v) => patch({ project: v })}
                placeholder="可留空，如「招呼 API」"
                maxLength={60}
              />
            </label>
            <label className="todos-field">
              <span>优先级</span>
              <Select
                value={form.priority}
                onChange={(v) => patch({ priority: v })}
                optionList={Object.entries(PRIORITY).map(([value, p]) => ({ value, label: p.label }))}
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <div className="todos-field-row">
            <label className="todos-field">
              <span>截止时间</span>
              <DatePicker
                type="dateTime"
                value={form.dueTime}
                onChange={(v) => patch({ dueTime: v })}
                placeholder="选择日期与时间"
                style={{ width: '100%' }}
              />
              <div className="todos-preset-row">
                <button type="button" onClick={() => applyDuePreset('today')}>今晚 18:00</button>
                <button type="button" onClick={() => applyDuePreset('tomorrow')}>明天 09:00</button>
                {form.dueTime && <button type="button" onClick={() => applyDuePreset('clear')}>清除</button>}
              </div>
            </label>
            <label className="todos-field">
              <span>单独提醒</span>
              <div className="todos-inline">
                {/* 后端只按 remindTime 判断是否提醒，取消勾选时一并清空 */}
                <Checkbox
                  checked={form.hasRemind}
                  onChange={(e) => patch({
                    hasRemind: e?.target?.checked === true,
                    remindTime: e?.target?.checked ? (form.remindTime || form.dueTime || null) : null
                  })}
                />
                <DatePicker
                  type="dateTime"
                  value={form.remindTime}
                  disabled={!form.hasRemind}
                  onChange={(v) => patch({ remindTime: v })}
                  placeholder="到点推送提醒"
                  style={{ width: '100%' }}
                />
              </div>
              {form.hasRemind && <div className="todos-preset-row">
                <button type="button" onClick={() => applyReminderOffset(0)}>截止时</button>
                <button type="button" onClick={() => applyReminderOffset(10)}>提前 10 分钟</button>
                <button type="button" onClick={() => applyReminderOffset(60)}>提前 1 小时</button>
                <button type="button" onClick={() => applyReminderOffset(1440)}>提前 1 天</button>
              </div>}
            </label>
          </div>

          <label className="todos-field">
            <span>提醒备注</span>
            <Input
              value={form.remindNote}
              disabled={!form.hasRemind}
              onChange={(v) => patch({ remindNote: v })}
              placeholder="推送时附带的说明，可留空"
              maxLength={120}
            />
          </label>

          <label className="todos-field">
            <span>循环</span>
            <Select
              value={form.recurType}
              onChange={changeRecurType}
              optionList={RECUR_TYPES}
              style={{ width: '100%' }}
            />
          </label>

          {form.recurType === 'WEEKLY' && (
            <div className="todos-days">
              {WEEK_DAYS.map((d) => {
                const on = form.recurDays.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    className={`todos-day${on ? ' is-on' : ''}`}
                    onClick={() => patch({
                      recurDays: on ? form.recurDays.filter((x) => x !== d.value) : [...form.recurDays, d.value]
                    })}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          )}

          {form.recurType === 'MONTHLY' && (
            <label className="todos-field">
              <span>每月日期</span>
              <Select
                value={form.recurDays[0] || '1'}
                onChange={(v) => patch({ recurDays: [v] })}
                optionList={MONTH_DAYS}
                filter
                style={{ width: 150 }}
              />
            </label>
          )}

          {(form.recurType === 'DAILY' || form.recurType === 'WEEKLY' || form.recurType === 'MONTHLY') && (
            <label className="todos-field">
              <span>循环时间</span>
              <TimePicker
                format="HH:mm"
                value={timeToDate(form.recurTime)}
                onChange={(v) => patch({ recurTime: v ? dayjs(v).format('HH:mm') : '' })}
                style={{ width: 140 }}
              />
            </label>
          )}

          {form.recurType === 'CUSTOM' && (
            <label className="todos-field">
              <span>Cron 表达式（六段）</span>
              <Input
                value={form.recurRaw}
                onChange={(v) => patch({ recurRaw: v })}
                placeholder="例如 0 15 8 L * ?"
              />
            </label>
          )}

          {form.recurType !== 'NONE' && buildRecurRule() && (
            <p className="todos-hint">当前规则：{fmtRule(buildRecurRule()) || buildRecurRule()}</p>
          )}

          <div className="todos-field">
            <span>子任务</span>
            <div className="todos-sub-editor">
              {form.subs.map((s, i) => (
                <div className="todos-sub-edit" key={s.id || `new-${i}`}>
                  <Checkbox
                    checked={s.done}
                    onChange={(e) => patch({
                      subs: form.subs.map((s, k) => (k === i ? { ...s, done: e?.target?.checked === true } : s))
                    })}
                  />
                  <Input
                    value={s.title}
                    onChange={(v) => {
                      const subs = [...form.subs]
                      subs[i] = { ...s, title: v }
                      patch({ subs })
                    }}
                    placeholder="拆成更小的一步"
                  />
                  <Button
                    size="small"
                    type="danger"
                    theme="borderless"
                    icon={<IconDelete />}
                    onClick={() => patch({ subs: form.subs.filter((_, k) => k !== i) })}
                  />
                </div>
              ))}
              <Button
                size="small"
                theme="borderless"
                icon={<IconPlus />}
                onClick={() => patch({ subs: [...form.subs, { id: null, title: '', done: false }] })}
              >
                添加子任务
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
