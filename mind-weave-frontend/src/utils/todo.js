import dayjs from 'dayjs'

export const WEEK_DAYS = [
  { value: 'MON', label: '周一' }, { value: 'TUE', label: '周二' }, { value: 'WED', label: '周三' },
  { value: 'THU', label: '周四' }, { value: 'FRI', label: '周五' }, { value: 'SAT', label: '周六' }, { value: 'SUN', label: '周日' }
]

export const defaultRecurrence = () => ({ type: 'DAILY', days: ['MON'], time: '09:00' })
const validTime = (hour, minute) => /^\d{1,2}$/.test(hour) && /^\d{1,2}$/.test(minute) && Number(hour) < 24 && Number(minute) < 60
const timeText = (hour, minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
const validMonthDays = (days) => days.every((d) => /^\d{1,2}$/.test(d) && Number(d) >= 1 && Number(d) <= 31)
const normalizeWeekDay = (day) => ({ 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT', 7: 'SUN' }[day] || day)
const validWeekDays = (days) => days.every((d) => WEEK_DAYS.some((w) => w.value === d))

// Only convert the schedules the form can represent; preserve advanced expressions on edit.
export function parseCronRule(rule) {
  if (!rule?.trim()) return defaultRecurrence()
  const raw = rule.trim()
  const legacyDailyHour = raw.toUpperCase().match(/^DAILY:(\d{1,2})$/)
  if (legacyDailyHour && validTime(legacyDailyHour[1], '0')) {
    return { type: 'DAILY', days: ['MON'], time: timeText(legacyDailyHour[1], '0') }
  }
  const legacyPeriodHour = raw.toUpperCase().match(/^(WEEKLY|MONTHLY):(.+):(\d{1,2})$/)
  if (legacyPeriodHour && validTime(legacyPeriodHour[3], '0')) {
    const [, type, dayText, hour] = legacyPeriodHour
    const days = dayText.split(',').map((d) => type === 'WEEKLY' ? normalizeWeekDay(d) : d)
    if ((type === 'WEEKLY' && validWeekDays(days)) || (type === 'MONTHLY' && validMonthDays(days))) {
      return { type, days, time: timeText(hour, '0') }
    }
  }
  const legacy = raw.toUpperCase().match(/^(DAILY|WEEKLY|MONTHLY):(?:(.+):)?(\d{1,2}):(\d{1,2})$/)
  if (legacy && validTime(legacy[3], legacy[4])) {
    const [, type, dayText, hour, minute] = legacy
    const days = (dayText || '').split(',').map((d) => type === 'WEEKLY' ? normalizeWeekDay(d) : d)
    if ((type === 'DAILY' && !dayText) || (type === 'WEEKLY' && validWeekDays(days)) || (type === 'MONTHLY' && validMonthDays(days))) {
      return { type, days: type === 'DAILY' ? ['MON'] : days, time: timeText(hour, minute) }
    }
  }
  const p = raw.toUpperCase().split(/\s+/)
  if (p.length === 6 && p[0] === '0' && p[4] === '*' && validTime(p[2], p[1])) {
    const time = timeText(p[2], p[1])
    // Weekly expressions use '?' in the day-of-month field, not a monthly day.
    if ((p[3] === '?' || p[3] === '*') && p[5] !== '?' && p[5] !== '*') {
      const days = p[5].split(',').map(normalizeWeekDay)
      if (validWeekDays(days)) return { type: 'WEEKLY', days, time }
    }
    if ((p[5] === '?' || p[5] === '*') && p[3] !== '?' && p[3] !== '*') {
      const days = p[3].split(',')
      if (validMonthDays(days)) return { type: 'MONTHLY', days, time }
    }
    if (['?', '*'].includes(p[3]) && ['?', '*'].includes(p[5])) return { type: 'DAILY', days: ['MON'], time }
  }
  return { ...defaultRecurrence(), type: 'CUSTOM', raw }
}

export function buildCron(recur) {
  if (!recur) return null
  if (recur.type === 'CUSTOM') return recur.raw || null
  const [hour, minute] = String(recur.time || '').split(':')
  if (!validTime(hour, minute)) return null
  if (recur.type === 'DAILY') return `0 ${Number(minute)} ${Number(hour)} * * ?`
  if (!recur.days?.length) return null
  if (recur.type === 'WEEKLY' && validWeekDays(recur.days)) return `0 ${Number(minute)} ${Number(hour)} ? * ${recur.days.join(',')}`
  if (recur.type === 'MONTHLY' && validMonthDays(recur.days)) return `0 ${Number(minute)} ${Number(hour)} ${recur.days.join(',')} * ?`
  return null
}

export function fmtRule(rule) {
  if (!rule) return ''
  const recur = parseCronRule(rule)
  if (recur.type === 'DAILY') return `每天 ${recur.time}`
  if (recur.type === 'WEEKLY') return `${recur.days.map((d) => WEEK_DAYS.find((w) => w.value === d)?.label || d).join('、')} ${recur.time}`
  if (recur.type === 'MONTHLY') return `每月 ${recur.days.join('、')} 日 ${recur.time}`
  return '自定义循环规则'
}

export function isDone(todo) { return Number(todo.done) === 1 }

export function matchesTimeFilter(todo, filter, now = dayjs()) {
  if (filter === 'all') return true
  if (isDone(todo) || !todo.dueTime) return false
  const due = dayjs(todo.dueTime)
  if (!due.isValid()) return false
  if (filter === 'overdue') return due.isBefore(now)
  if (filter === 'today') return due.isSame(now, 'day')
  if (filter === 'upcoming') return !due.isBefore(now.startOf('day').add(1, 'day')) && due.isBefore(now.startOf('day').add(8, 'day'))
  return true
}

export function reminderState(todo, now = dayjs()) {
  if (isDone(todo)) return { label: '已停止 · 任务完成', tone: 'muted' }
  if (todo.recurRule?.trim() && todo.remindTime && Number(todo.remindSent) !== 1) {
    const due = dayjs(todo.remindTime).isBefore(now)
    return { label: due ? '循环中 · 单次提醒待发送' : '循环 + 单次提醒', tone: due ? 'orange' : 'purple', detail: fmtRule(todo.recurRule) }
  }
  if (todo.recurRule?.trim()) return { label: '循环提醒中', tone: 'purple', detail: fmtRule(todo.recurRule) }
  if (!todo.remindTime) return { label: '无单独提醒', tone: 'muted' }
  if (Number(todo.remindSent) === 1) return { label: '已发送', tone: 'green' }
  return { label: dayjs(todo.remindTime).isBefore(now) ? '已到点 · 待发送' : '待发送', tone: dayjs(todo.remindTime).isBefore(now) ? 'orange' : 'blue' }
}
