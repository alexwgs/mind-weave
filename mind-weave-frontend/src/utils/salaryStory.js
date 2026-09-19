const numberValue = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildSalaryStory(points, metric = 'netPay') {
  const timeline = (points || [])
    .map((point) => ({ ...point, value: numberValue(point?.[metric]) }))
    .filter((point) => point.month && point.value >= 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)))

  if (!timeline.length) return null

  const total = timeline.reduce((sum, point) => sum + point.value, 0)
  const average = total / timeline.length
  const best = timeline.reduce((winner, point) => point.value > winner.value ? point : winner, timeline[0])
  let biggestRise = null
  let currentStreak = 1
  let longestStreak = 1

  for (let index = 1; index < timeline.length; index += 1) {
    const difference = timeline[index].value - timeline[index - 1].value
    if (!biggestRise || difference > biggestRise.difference) {
      biggestRise = { point: timeline[index], difference }
    }
    if (difference > 0) {
      currentStreak += 1
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 1
    }
  }

  if (biggestRise?.difference <= 0) biggestRise = null
  const first = timeline[0]
  const last = timeline[timeline.length - 1]
  const changeRate = first.value > 0 ? ((last.value - first.value) / first.value) * 100 : null

  return {
    timeline,
    total,
    average,
    best,
    biggestRise,
    longestStreak,
    first,
    last,
    changeRate,
    workdayValue: average / 21.75,
    hourValue: average / 21.75 / 8,
    completedTenThousands: Math.floor(total / 10000)
  }
}

export function salaryStorySummary(story, metricLabel = '实发') {
  if (!story) return ''
  const money = (value) => Math.round(value).toLocaleString('zh-CN')
  const growth = story.changeRate == null
    ? '还在积累第一个可比较的起点'
    : `首尾变化 ${story.changeRate >= 0 ? '+' : ''}${story.changeRate.toFixed(1)}%`
  return `我的薪资时光机｜${story.first.month.slice(0, 7)}—${story.last.month.slice(0, 7)}：${metricLabel}累计 ¥${money(story.total)}，月均 ¥${money(story.average)}，高光月份 ${story.best.month.slice(0, 7)}（¥${money(story.best.value)}），${growth}。`
}
