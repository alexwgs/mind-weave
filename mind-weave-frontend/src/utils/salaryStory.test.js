import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSalaryStory, salaryStorySummary } from './salaryStory.js'

const points = [
  { month: '2026-03', netPay: 13000, totalSalary: 17000 },
  { month: '2026-01', netPay: 10000, totalSalary: 14000 },
  { month: '2026-02', netPay: 12000, totalSalary: 15000 },
  { month: '2026-04', netPay: 12500, totalSalary: 16500 },
  { month: '2026-05', netPay: 14000, totalSalary: 18000 }
]

test('builds a chronological salary story and finds its highlights', () => {
  const story = buildSalaryStory(points)
  assert.equal(story.total, 61500)
  assert.equal(story.average, 12300)
  assert.equal(story.first.month, '2026-01')
  assert.equal(story.best.month, '2026-05')
  assert.equal(story.biggestRise.point.month, '2026-02')
  assert.equal(story.biggestRise.difference, 2000)
  assert.equal(story.longestStreak, 3)
  assert.equal(story.completedTenThousands, 6)
})

test('supports total salary and handles empty data', () => {
  assert.equal(buildSalaryStory(points, 'totalSalary').total, 80500)
  assert.equal(buildSalaryStory([]), null)
  assert.equal(salaryStorySummary(null), '')
})

test('produces a concise shareable summary', () => {
  const summary = salaryStorySummary(buildSalaryStory(points), '实发')
  assert.match(summary, /累计 ¥61,500/)
  assert.match(summary, /高光月份 2026-05/)
  assert.match(summary, /首尾变化 \+40\.0%/)
})
