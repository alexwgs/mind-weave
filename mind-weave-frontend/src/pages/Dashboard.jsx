import { useEffect, useMemo, useState } from 'react'
import { Card, Col, Row, Select, Skeleton } from '@douyinfe/semi-ui'
import { statsApi } from '../api'
import { fmtMoney } from '../utils'
import { useEChart } from '../hooks'
import SalaryTimeMachine from '../components/SalaryTimeMachine'

const YEARS = [2023, 2024, 2025, 2026]

function lineOption(labels, name, data, color) {
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '-' : Number(v).toLocaleString()) },
    grid: { left: 70, right: 20, top: 40, bottom: 40 },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    series: [{ name, type: 'line', smooth: true, data, areaStyle: { opacity: 0.12 }, itemStyle: { color } }]
  }
}

function barOption(labels, name, data, color, growths) {
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v) => Number(v).toLocaleString() },
    grid: { left: 70, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    series: [{
      name, type: 'bar', barWidth: 36, data, itemStyle: { color },
      label: {
        show: true, position: 'top',
        formatter: (p) => {
          const g = growths?.[p.dataIndex]
          return g === null || g === undefined ? '' : `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`
        }
      }
    }]
  }
}

export default function Dashboard() {
  const [yearFrom, setYearFrom] = useState(2023)
  const [yearTo, setYearTo] = useState(2026)
  const [overview, setOverview] = useState(null)
  const [annual, setAnnual] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const from = Math.min(yearFrom, yearTo)
    const to = Math.max(yearFrom, yearTo)
    if (from !== yearFrom || to !== yearTo) {
      setYearFrom(from)
      setYearTo(to)
    }
    const params = { yearFrom: from, yearTo: to }
    setLoading(true)
    Promise.all([
      statsApi.overview(params),
      statsApi.annual(params),
      statsApi.trend(params)
    ]).then(([o, a, t]) => {
      setOverview(o)
      setAnnual(a)
      setTrend(t)
    }).finally(() => setLoading(false))
  }, [yearFrom, yearTo])

  const cards = useMemo(() => {
    if (!overview) return []
    return [
      { label: '区间实发合计', value: fmtMoney(overview.rangeNetPay), extra: `${overview.yearFrom}-${overview.yearTo}`, color: 'var(--semi-color-primary)' },
      { label: '区间总薪资合计', value: fmtMoney(overview.rangeTotalSalary), extra: '实发+其他奖金+年度实发', color: '#722ed1' },
      { label: '最近月份实发', value: fmtMoney(overview.latestMonthNet), extra: overview.latestMonth || '—', color: '#00b42a' },
      { label: '最近月份总薪资', value: fmtMoney(overview.latestMonthTotal), extra: overview.latestMonth || '—', color: '#fa8c16' },
      { label: '区间记录月数', value: overview.monthCount, extra: '条月度记录', color: 'var(--semi-color-text-2)' },
      { label: '区间批注总数', value: overview.commentCount, extra: '区间内记录批注', color: '#f53f3f' }
    ]
  }, [overview])

  const monthLabels = trend.map((d) => d.month.slice(0, 7))
  const yearLabels = annual.map((a) => a.year)

  const netTrendRef = useEChart(lineOption(monthLabels, '实发', trend.map((d) => d.netPay), '#3370ff'), [trend])
  const totalTrendRef = useEChart(lineOption(monthLabels, '总薪资', trend.map((d) => d.totalSalary), '#722ed1'), [trend])
  const netAnnualRef = useEChart(barOption(yearLabels, '实发', annual.map((a) => a.netPay), '#3370ff', annual.map((a) => a.netGrowth)), [annual])
  const totalAnnualRef = useEChart(barOption(yearLabels, '总薪资', annual.map((a) => a.totalSalary), '#722ed1', annual.map((a) => a.totalSalaryGrowth)), [annual])

  return (
    <div>
      <div className="page-card filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>时间区间</span>
          <Select value={yearFrom} onChange={setYearFrom} optionList={YEARS.map((y) => ({ value: y, label: String(y) }))} style={{ width: 110 }} />
          <span>至</span>
          <Select value={yearTo} onChange={setYearTo} optionList={YEARS.map((y) => ({ value: y, label: String(y) }))} style={{ width: 110 }} />
        </div>
      </div>

      <Skeleton placeholder={<Row><Col span={4}><Card /></Col><Col span={4}><Card /></Col><Col span={4}><Card /></Col><Col span={4}><Card /></Col></Row>} loading={loading} active>
        <Row gutter={[16, 16]}>
          {cards.map((c) => (
            <Col xs={12} sm={8} md={4} key={c.label}>
              <Card className="stat-card">
                <div className="stat-label">{c.label}</div>
                <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
                <div className="stat-extra">{c.extra}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Skeleton>

      {!loading && <SalaryTimeMachine trend={trend} />}

      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} md={12}>
          <Card title={`月度实发金额趋势（${yearFrom}-${yearTo}）`} bodyStyle={{ height: 340, padding: 0 }}>
            <div ref={netTrendRef} style={{ height: 340 }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={`月度总薪资趋势（${yearFrom}-${yearTo}）`} bodyStyle={{ height: 340, padding: 0 }}>
            <div ref={totalTrendRef} style={{ height: 340 }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="年度实发金额对比" bodyStyle={{ height: 340, padding: 0 }}>
            <div ref={netAnnualRef} style={{ height: 340 }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="年度总薪资对比" bodyStyle={{ height: 340, padding: 0 }}>
            <div ref={totalAnnualRef} style={{ height: 340 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
