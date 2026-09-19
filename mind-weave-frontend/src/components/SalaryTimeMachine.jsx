import { useEffect, useMemo, useState } from 'react'
import { Button, Toast } from '@douyinfe/semi-ui'
import { IconArrowUp, IconClock, IconCopy, IconStar } from '@douyinfe/semi-icons'
import { buildSalaryStory, salaryStorySummary } from '../utils/salaryStory'
import './salary-time-machine.css'

const money = (value) => Math.round(Number(value || 0)).toLocaleString('zh-CN')
const monthLabel = (month) => {
  const text = String(month || '')
  return text.length >= 7 ? `${Number(text.slice(5, 7))}月` : text
}

export default function SalaryTimeMachine({ trend = [] }) {
  const [year, setYear] = useState('all')
  const [metric, setMetric] = useState('netPay')
  const [focusMonth, setFocusMonth] = useState(null)
  const years = useMemo(() => [...new Set(trend.map((point) => String(point.month).slice(0, 4)))].sort(), [trend])
  const filtered = useMemo(
    () => year === 'all' ? trend : trend.filter((point) => String(point.month).startsWith(year)),
    [trend, year]
  )
  const story = useMemo(() => buildSalaryStory(filtered, metric), [filtered, metric])
  const maxValue = story ? Math.max(...story.timeline.map((point) => point.value), 1) : 1
  const focused = story?.timeline.find((point) => point.month === focusMonth) || story?.best
  const metricLabel = metric === 'netPay' ? '实发' : '总薪资'

  useEffect(() => {
    setFocusMonth(null)
  }, [year, metric])

  useEffect(() => {
    if (year !== 'all' && !years.includes(year)) setYear('all')
  }, [year, years])

  if (!story) return null

  const copyStory = async () => {
    const text = salaryStorySummary(story, metricLabel)
    try {
      await navigator.clipboard.writeText(text)
      Toast.success('成长旁白已复制')
    } catch {
      Toast.warning('浏览器未允许复制，请稍后重试')
    }
  }

  return (
    <section className="salary-machine" aria-labelledby="salary-machine-title">
      <div className="machine-head">
        <div>
          <span className="machine-kicker">SALARY TIME MACHINE · 薪资时光机</span>
          <h2 id="salary-machine-title">把数字倒带，看看你走了多远</h2>
        </div>
        <div className="machine-actions">
          <div className="machine-segment" aria-label="统计口径">
            {[['netPay', '看实发'], ['totalSalary', '看总薪资']].map(([value, label]) => (
              <button key={value} type="button" className={metric === value ? 'is-active' : ''} onClick={() => setMetric(value)} aria-pressed={metric === value}>{label}</button>
            ))}
          </div>
          <Button theme="borderless" icon={<IconCopy />} onClick={copyStory}>复制旁白</Button>
        </div>
      </div>

      <div className="machine-years" aria-label="选择时间范围">
        <button type="button" className={year === 'all' ? 'is-active' : ''} onClick={() => setYear('all')}>全部旅程</button>
        {years.map((item) => <button type="button" key={item} className={year === item ? 'is-active' : ''} onClick={() => setYear(item)}>{item}</button>)}
      </div>

      <div className="machine-stage">
        <div className="machine-story">
          <span className="story-period">{story.first.month.slice(0, 7)} — {story.last.month.slice(0, 7)}</span>
          <p>这段旅程里，你一共把</p>
          <strong><small>¥</small>{money(story.total)}</strong>
          <p>写进了自己的{metricLabel}记录。</p>
          <div className="story-footnote">
            <span>{story.completedTenThousands > 0 ? `跨过 ${story.completedTenThousands} 个万元刻度` : '第一段积累正在发生'}</span>
            <i aria-hidden="true" />
            <span>{story.timeline.length} 个月有迹可循</span>
          </div>
        </div>

        <div className="salary-film" aria-label={`${metricLabel}月度时间轴`}>
          <div className="film-focus" aria-live="polite">
            <div><span>{focused?.month?.slice(0, 7)}</span><strong>¥{money(focused?.value)}</strong></div>
            <small>{focused?.month === story.best.month ? '本段高光时刻' : `当月${metricLabel}`}</small>
          </div>
          <div className="film-track">
            {story.timeline.map((point) => {
              const height = 18 + (point.value / maxValue) * 82
              const active = point.month === focused?.month
              return (
                <button
                  type="button"
                  key={point.month}
                  className={`film-frame${active ? ' is-active' : ''}${point.month === story.best.month ? ' is-best' : ''}`}
                  onClick={() => setFocusMonth(point.month)}
                  aria-label={`${point.month.slice(0, 7)}，${metricLabel}${money(point.value)}元`}
                  aria-pressed={active}
                >
                  <span className="film-bar"><i style={{ height: `${height}%` }} /></span>
                  <span>{monthLabel(point.month)}</span>
                </button>
              )
            })}
          </div>
          <div className="film-caption"><span>点击任一月份查看</span><span>越高，代表当月越接近高光</span></div>
        </div>
      </div>

      <div className="machine-insights">
        <div><IconStar /><span>高光月份<small>{story.best.month.slice(0, 7)}</small></span><strong>¥{money(story.best.value)}</strong></div>
        <div><IconArrowUp /><span>最长上升段<small>{story.longestStreak > 1 ? '连续走高' : '等待下一次突破'}</small></span><strong>{story.longestStreak > 1 ? `${story.longestStreak} 个月` : '—'}</strong></div>
        <div><IconClock /><span>时间价值<small>按 21.75 天 × 8 小时估算</small></span><strong>¥{money(story.hourValue)} / 时</strong></div>
        <div className={story.changeRate != null && story.changeRate < 0 ? 'is-down' : ''}>
          <span className="insight-glyph">↗</span><span>首尾变化<small>{story.first.month.slice(0, 7)} 对比 {story.last.month.slice(0, 7)}</small></span>
          <strong>{story.changeRate == null ? '—' : `${story.changeRate >= 0 ? '+' : ''}${story.changeRate.toFixed(1)}%`}</strong>
        </div>
      </div>
    </section>
  )
}
