const { get, post, put, del } = require('../../utils/request')

// 微信订阅消息模板（日程提醒）
const DEFAULT_WX_SUBSCRIBE_TMPL = 'MaTS2FNCD0UiyBHsCVwgIRLvyJ9QXEcOOP22cpm69WU'

const PRESET_TAGS = ['工作', '学习', '生活', '健康', '家庭', '财务', '旅行', '购物', '其他']
const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEK_VALUES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const WEEK_CHIPS = WEEK_DAYS.map((label, i) => ({ value: WEEK_VALUES[i], label }))
const MONTH_DAYS = []
for (let i = 1; i <= 31; i++) MONTH_DAYS.push(String(i))

// 可视化选择 -> 自动生成 Spring cron 表达式（秒 分 时 日 月 周）
function buildCron(type, days, day, time) {
  const t = String(time || '09:00').slice(0, 5)
  const parts = t.split(':')
  const h = parts[0] || '09'
  const m = parts[1] || '00'
  if (type === 'DAILY') return '0 ' + m + ' ' + h + ' * * ?'
  if (type === 'WEEKLY') {
    const d = (days && days.length ? days : ['MON']).join(',')
    return '0 ' + m + ' ' + h + ' ? * ' + d
  }
  if (type === 'MONTHLY') {
    const d = day || '1'
    return '0 ' + m + ' ' + h + ' ' + d + ' * ?'
  }
  return ''
}

function parseRuleCron(rule) {
  const out = { type: '', days: [], day: '1', time: '09:00', label: '' }
  if (!rule) return out
  const s = String(rule).trim()
  if (/\s/.test(s)) {
    const p = s.split(/\s+/)
    if (p.length === 6) {
      out.time = p[2] + ':' + p[1]
      if (p[3] !== '*') {
        out.type = 'MONTHLY'
        out.day = p[3]
        out.label = p[3] + '日'
      } else if (p[5] !== '?' && p[5] !== '*') {
        out.type = 'WEEKLY'
        out.days = p[5].split(',')
        out.label = WEEK_DAYS[WEEK_VALUES.indexOf(out.days[0])] || ''
      } else {
        out.type = 'DAILY'
      }
      return out
    }
  }
  // 旧格式：DAILY:17:30 / WEEKLY:MON,WED:10:00 / MONTHLY:1,15:09:00
  const parts = s.split(':')
  const type = parts[0]
  const isDaily = type === 'DAILY'
  const dayPart = isDaily ? '' : (parts[1] || (type === 'MONTHLY' ? '1' : 'MON'))
  out.type = type
  const legacyTime = isDaily ? parts.slice(1).join(':') : parts.slice(2).join(':')
  out.time = /^\d{1,2}$/.test(legacyTime) ? legacyTime.padStart(2, '0') + ':00' : (legacyTime || '09:00')
  if (type === 'WEEKLY') {
    out.days = dayPart ? dayPart.split(',') : []
    out.label = WEEK_DAYS[WEEK_VALUES.indexOf((out.days[0] || 'MON'))] || '周一'
  }
  if (type === 'MONTHLY') {
    out.day = dayPart || '1'
    out.label = out.day + '日'
  }
  return out
}

function fmtRule(rule) {
  if (!rule) return ''
  const p = parseRuleCron(rule)
  if (p.type === 'DAILY') return '每天 ' + p.time
  if (p.type === 'WEEKLY') {
    const labels = (p.days.length ? p.days : ['MON']).map((d) => WEEK_DAYS[WEEK_VALUES.indexOf(d)] || d)
    return '每周' + labels.join('、') + ' ' + p.time
  }
  if (p.type === 'MONTHLY') return '每月' + (p.day || p.days.join('、')) + '日 ' + p.time
  return String(rule)
}

function daySet(days) {
  const set = {}
  ;(days || []).forEach((d) => {
    set[d] = true
  })
  return set
}

Page({
  data: {
    status: 'active',
    presetTags: PRESET_TAGS,
    weekDayOptions: WEEK_DAYS,
    weekChips: WEEK_CHIPS,
    monthDayOptions: MONTH_DAYS,
    swipeId: null,
    startX: 0,
    startY: 0,
    rows: [],
    page: 1,
    hasMore: true,
    loading: false,
    saving: false,
    busyId: '',
    summary: { active: 0, today: 0, overdue: 0, withReminder: 0 },
    pushStatus: null,
    showForm: false,
    priorities: ['高', '中', '低'],
    priorityIndex: 1,
    form: {
      id: null,
      title: '',
      project: '',
      priority: 'MEDIUM',
      dueDate: '',
      dueTime: '',
      remindDate: '',
      remindTime: '',
      recurType: '',
      recurDay: 'MON',
      recurTime: '09:00',
      subs: []
    }
  },
  onLoad() {
    this.load(true)
    this.loadMeta()
  },
  onPullDownRefresh() {
    Promise.all([this.load(true), this.loadMeta()]).finally(() => wx.stopPullDownRefresh())
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.load(false)
  },
  onStatus(e) {
    const status = e.currentTarget.dataset.v
    this.setData({ status, swipeId: null }, () => this.load(true, status))
  },
  async load(reset, forcedStatus) {
    if (this.data.loading && !reset) return
    const requestId = (this._loadSeq || 0) + 1
    this._loadSeq = requestId
    this.setData({ loading: true })
    const page = reset ? 1 : this.data.page + 1
    try {
      const params = { page, size: 50, status: forcedStatus || this.data.status }
      const qs = Object.keys(params).map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&')
      const data = await get('/tool/todos?' + qs)
      if (requestId !== this._loadSeq) return
      const records = (data.records || []).map((r) => ({
        ...r,
        dueText: r.dueTime ? String(r.dueTime).slice(0, 19).replace('T', ' ') : '',
        remindText: r.remindTime ? String(r.remindTime).slice(0, 19).replace('T', ' ') : '',
        remindNote: r.remindNote || '',
        recurText: fmtRule(r.recurRule),
        expanded: false
      }))
      this.setData({
        rows: reset ? records : this.data.rows.concat(records),
        page,
        hasMore: page * 50 < (data.total || 0)
      })
    } finally {
      if (requestId === this._loadSeq) this.setData({ loading: false })
    }
  },
  async loadMeta() {
    const [summary, pushStatus] = await Promise.all([
      get('/tool/todos/summary', true).catch(() => null),
      get('/tool/todos/scheduler-status', true).catch(() => null)
    ])
    if (summary) this.setData({ summary })
    if (pushStatus) this.setData({ pushStatus })
  },
  async toggle(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.busyId) return
    this.setData({ busyId: id })
    try {
      await post(`/tool/todos/${id}/toggle`)
      await Promise.all([this.load(true), this.loadMeta()])
    } finally {
      this.setData({ busyId: '' })
    }
  },
  onToggleExpand(e) {
    if (this._justSwiped) {
      this._justSwiped = false
      return
    }
    const id = e.currentTarget.dataset.id
    const rows = this.data.rows.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r))
    this.setData({ rows })
  },
  onLongPress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定删除该待办？',
      success: async (res) => {
        if (!res.confirm) return
        await del(`/tool/todos/${id}`)
        await Promise.all([this.load(true), this.loadMeta()])
      }
    })
  },
  openForm() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    this.setData({
      showForm: true,
      form: {
        id: null,
        title: '',
        project: '',
        priority: 'MEDIUM',
        dueDate: '',
        dueTime: '',
        remindDate: '',
        remindTime: '',
        remindNote: '',
        recurType: '',
        recurDay: 'MON',
        recurDayLabel: '周一',
        recurDays: [],
        recurDaySet: {},
        recurTime: '09:00',
        subs: []
      }
    })
  },
  openEdit(row) {
    const splitDT = (t) => {
      if (!t) return { d: '', t: '' }
      const s = String(t).slice(0, 19).replace('T', ' ')
      const idx = s.indexOf(' ')
      return { d: s.slice(0, idx), t: idx > 0 ? s.slice(idx + 1, idx + 6) : '' }
    }
    const due = splitDT(row.dueTime)
    const remind = splitDT(row.remindTime)
    const p = parseRuleCron(row.recurRule || '')
    const labels = { MON: '周一', TUE: '周二', WED: '周三', THU: '周四', FRI: '周五', SAT: '周六', SUN: '周日' }
    const recurDay = p.type === 'MONTHLY' ? p.day : 'MON'
    this.setData({
      showForm: true,
      priorityIndex: row.priority === 'HIGH' ? 0 : row.priority === 'LOW' ? 2 : 1,
      form: {
        id: row.id,
        title: row.title || '',
        project: row.project || '',
        priority: row.priority || 'MEDIUM',
        dueDate: due.d,
        dueTime: due.t,
        remindDate: remind.d,
        remindTime: remind.t,
        remindNote: row.remindNote || '',
        recurType: p.type,
        recurDay,
        recurDayLabel: p.type === 'MONTHLY' ? recurDay + '日' : (labels[recurDay] || ''),
        recurDays: p.days,
        recurDaySet: daySet(p.days),
        recurTime: p.time,
        subs: (row.subs || []).map((s) => ({ title: s.title || '', done: s.done || 0 }))
      }
    })
  },
  onTouchStart(e) {
    this.setData({ startX: e.touches[0].clientX, startY: e.touches[0].clientY })
    this._swiping = false
  },
  onTouchMove(e) {
    const dx = e.touches[0].clientX - this.data.startX
    const dy = e.touches[0].clientY - this.data.startY
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      this._swipeDx = dx
      this._swiping = true
    }
  },
  onTouchEnd(e) {
    const dx = this._swipeDx || 0
    this._swipeDx = 0
    if (dx < -40) this.setData({ swipeId: e.currentTarget.dataset.id })
    else if (dx > 40) this.setData({ swipeId: null })
    this._justSwiped = this._swiping
    if (this._justSwiped) {
      setTimeout(() => {
        this._justSwiped = false
      }, 180)
    }
  },
  onEditTodo(e) {
    const id = e.currentTarget.dataset.id
    const row = this.data.rows.find((r) => r.id === id)
    this.setData({ swipeId: null })
    if (row) this.openEdit(row)
  },
  onDeleteTodo(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ swipeId: null })
    wx.showModal({
      title: '提示',
      content: '确定删除该待办？',
      success: async (res) => {
        if (!res.confirm) return
        await del(`/tool/todos/${id}`)
        await Promise.all([this.load(true), this.loadMeta()])
      }
    })
  },
  onRecurType(e) {
    const v = e.currentTarget.dataset.v
    this.setData({
      'form.recurType': v,
      'form.recurDay': v === 'WEEKLY' ? 'MON' : '1',
      'form.recurDayLabel': v === 'WEEKLY' ? '周一' : (v === 'MONTHLY' ? '1日' : ''),
      'form.recurTime': '09:00',
      'form.recurDays': v === 'WEEKLY' ? ['MON'] : [],
      'form.recurDaySet': v === 'WEEKLY' ? daySet(['MON']) : {}
    })
  },
  onRecurDayToggle(e) {
    const v = e.currentTarget.dataset.v
    let days = [...this.data.form.recurDays]
    days = days.includes(v) ? days.filter((d) => d !== v) : [...days, v]
    this.setData({ 'form.recurDays': days, 'form.recurDaySet': daySet(days) })
  },
  onRecurDay(e) {
    const idx = Number(e.detail.value)
    const day = this.data.form.recurType === 'WEEKLY' ? WEEK_VALUES[idx] : MONTH_DAYS[idx]
    const label = this.data.form.recurType === 'WEEKLY' ? WEEK_DAYS[idx] : MONTH_DAYS[idx] + '日'
    this.setData({ 'form.recurDay': day, 'form.recurDayLabel': label })
  },
  onPresetTag(e) {
    this.setData({ 'form.project': e.currentTarget.dataset.v })
  },
  onRecurTime(e) {
    this.setData({ 'form.recurTime': e.detail.value })
  },
  setDuePreset(e) {
    const kind = e.currentTarget.dataset.v
    if (kind === 'clear') {
      this.setData({ 'form.dueDate': '', 'form.dueTime': '', 'form.remindDate': '', 'form.remindTime': '' })
      return
    }
    const d = new Date()
    if (kind === 'tomorrow') d.setDate(d.getDate() + 1)
    let hour = kind === 'tomorrow' ? 9 : 18
    if (kind === 'today' && d.getHours() >= 18) {
      d.setDate(d.getDate() + 1)
      hour = 9
    }
    const pad = (n) => String(n).padStart(2, '0')
    this.setData({
      'form.dueDate': `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      'form.dueTime': `${pad(hour)}:00`
    })
  },
  enableReminder() {
    const f = this.data.form
    if (f.remindDate) {
      this.setData({ 'form.remindDate': '', 'form.remindTime': '' })
      return
    }
    if (f.dueDate) {
      this.setData({ 'form.remindDate': f.dueDate, 'form.remindTime': f.dueTime || '09:00' })
      return
    }
    const d = new Date(Date.now() + 60 * 60 * 1000)
    const pad = (n) => String(n).padStart(2, '0')
    this.setData({ 'form.remindDate': `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, 'form.remindTime': `${pad(d.getHours())}:${pad(d.getMinutes())}` })
  },
  setReminderPreset(e) {
    const minutes = Number(e.currentTarget.dataset.v)
    const f = this.data.form
    if (!f.dueDate) return wx.showToast({ title: '请先设置截止时间', icon: 'none' })
    const date = new Date(`${f.dueDate}T${f.dueTime || '09:00'}:00`)
    date.setMinutes(date.getMinutes() - minutes)
    const pad = (n) => String(n).padStart(2, '0')
    this.setData({ 'form.remindDate': `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, 'form.remindTime': `${pad(date.getHours())}:${pad(date.getMinutes())}` })
  },
  onForm(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ [`form.${k}`]: e.detail.value })
  },
  onPriority(e) {
    const labels = ['HIGH', 'MEDIUM', 'LOW']
    this.setData({ priorityIndex: Number(e.detail.value), 'form.priority': labels[Number(e.detail.value)] })
  },
  onSub(e) {
    const i = e.currentTarget.dataset.i
    this.setData({ [`form.subs[${i}].title`]: e.detail.value })
  },
  addSub() {
    this.setData({ 'form.subs': [...this.data.form.subs, { title: '', done: 0 }] })
  },
  removeSub(e) {
    const subs = this.data.form.subs.filter((_, i) => i !== Number(e.currentTarget.dataset.i))
    this.setData({ 'form.subs': subs })
  },
  closeForm() {
    this.setData({ showForm: false })
  },
  async saveForm() {
    if (this.data.saving) return
    const f = this.data.form
    if (!f.title.trim()) {
      wx.showToast({ title: '标题必填', icon: 'none' })
      return
    }
    if (f.recurType === 'WEEKLY' && !f.recurDays.length) {
      wx.showToast({ title: '请至少选择一个星期', icon: 'none' })
      return
    }
    const dueValue = f.dueDate ? `${f.dueDate}T${f.dueTime || '09:00'}:00` : null
    const remindValue = f.remindDate ? `${f.remindDate}T${f.remindTime || '09:00'}:00` : null
    if (dueValue && remindValue && new Date(remindValue).getTime() > new Date(dueValue).getTime()) {
      wx.showToast({ title: '提醒不能晚于截止时间', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      let subscribeResult = 'skipped'
      if (f.remindDate || f.recurType) subscribeResult = await this.requestSubscription()
      const payload = {
        title: f.title.trim(),
        project: f.project || null,
        priority: f.priority,
        dueTime: dueValue,
        remindTime: remindValue,
        remindNote: f.remindNote || null,
        recurRule: f.recurType ? buildCron(f.recurType, f.recurDays, f.recurDay, f.recurTime) : null,
        subs: f.subs.filter((s) => s && s.title && s.title.trim()).map((s) => ({ title: s.title.trim(), done: s.done || 0 }))
      }
      if (f.id) await put(`/tool/todos/${f.id}`, payload)
      else await post('/tool/todos', payload)
      if (subscribeResult === 'accepted') await post('/tool/todos/subscription-granted', {}).catch(() => null)
      wx.showToast({ title: subscribeResult === 'rejected' ? '已保存，微信提醒未授权' : '已保存', icon: subscribeResult === 'rejected' ? 'none' : 'success' })
      this.setData({ showForm: false })
      await Promise.all([this.load(true), this.loadMeta()])
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '保存失败，请重试', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },
  requestSubscription() {
    const templateId = (this.data.pushStatus && this.data.pushStatus.templateId) || DEFAULT_WX_SUBSCRIBE_TMPL
    return new Promise((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds: [templateId],
        success: (res) => resolve(res[templateId] === 'accept' ? 'accepted' : 'rejected'),
        fail: () => resolve('rejected')
      })
    })
  },
  openAi() {
    wx.navigateTo({ url: '/pages/ai-chat/ai-chat' })
  }
})
