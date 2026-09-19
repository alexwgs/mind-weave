import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'
import { buildCron, fmtRule, matchesTimeFilter, parseCronRule, reminderState } from './todo.js'

test('weekly Spring expressions are not mistaken for monthly rules', () => {
  const parsed = parseCronRule('0 30 9 ? * MON,WED')
  assert.deepEqual(parsed, { type: 'WEEKLY', days: ['MON', 'WED'], time: '09:30' })
  assert.equal(buildCron(parsed), '0 30 9 ? * MON,WED')
  assert.equal(fmtRule('0 30 9 ? * MON,WED'), '周一、周三 09:30')
})

test('legacy weekly and monthly rules retain the minute value', () => {
  assert.equal(buildCron(parseCronRule('DAILY:00')), '0 0 0 * * ?')
  assert.equal(buildCron(parseCronRule('WEEKLY:MON,WED:09')), '0 0 9 ? * MON,WED')
  assert.equal(buildCron(parseCronRule('WEEKLY:MON,FRI:10:45')), '0 45 10 ? * MON,FRI')
  assert.equal(buildCron(parseCronRule('MONTHLY:1,15:09:25')), '0 25 9 1,15 * ?')
  assert.equal(buildCron(parseCronRule('DAILY:17:30')), '0 30 17 * * ?')
})

test('advanced schedules round trip unchanged and numeric weekdays follow Spring semantics', () => {
  for (const rule of ['0 */15 8-17 * * MON-FRI', '0 15 8 L * ?', '0 0 9 * JAN *']) {
    assert.equal(parseCronRule(rule).type, 'CUSTOM')
    assert.equal(buildCron(parseCronRule(rule)), rule)
  }
  assert.deepEqual(parseCronRule('0 5 8 ? * 0,1,7').days, ['SUN', 'MON', 'SUN'])
  assert.equal(buildCron({ type: 'MONTHLY', days: ['31'], time: '09:00' }), '0 0 9 31 * ?')
  assert.equal(buildCron({ type: 'WEEKLY', days: [], time: '09:00' }), null)
  assert.equal(buildCron({ type: 'DAILY', time: '25:00' }), null)
})

test('date filtering parses ISO timestamps and excludes completed tasks', () => {
  const now = dayjs('2026-09-12T10:00:00')
  assert.equal(matchesTimeFilter({ dueTime: '2026-09-12T09:00:00', done: 0 }, 'overdue', now), true)
  assert.equal(matchesTimeFilter({ dueTime: '2026-09-12T09:00:00', done: 1 }, 'overdue', now), false)
  assert.equal(matchesTimeFilter({ dueTime: '2026-09-12T18:00:00' }, 'today', now), true)
  assert.equal(matchesTimeFilter({ dueTime: '2026-09-19T23:59:00' }, 'upcoming', now), true)
  assert.equal(matchesTimeFilter({ dueTime: '2026-09-20T00:00:00' }, 'upcoming', now), false)
  assert.equal(matchesTimeFilter({ dueTime: null }, 'today', now), false)
})

test('completed tasks never appear as pending and cycle status ignores one-off sent flags', () => {
  assert.equal(reminderState({ done: 1, remindTime: '2026-09-01T09:00:00' }).tone, 'muted')
  assert.equal(reminderState({ done: 0, recurRule: '0 0 9 * * ?', remindSent: 1 }).label, '循环提醒中')
  assert.equal(reminderState({ remindTime: '2026-09-01T09:00:00', remindSent: 1 }).label, '已发送')
  assert.equal(reminderState({}).label, '无单独提醒')
})

test('recurring tasks can also carry a one-off reminder', () => {
  const state = reminderState({ done: 0, recurRule: '0 0 9 * * ?', remindTime: '2026-09-20T08:00:00', remindSent: 0 }, dayjs('2026-09-19T08:00:00'))
  assert.equal(state.label, '循环 + 单次提醒')
  assert.equal(state.tone, 'purple')
})
