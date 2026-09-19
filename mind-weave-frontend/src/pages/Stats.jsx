import { useEffect, useMemo, useState } from 'react'
import { Card, Col, Row, Table } from '@douyinfe/semi-ui'
import { statsApi } from '../api'
import { fmtMoney } from '../utils'
import { useEChart } from '../hooks'
import GrowthTag from '../components/GrowthTag'

function lineOption(labels, series) {
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '-' : Number(v).toLocaleString()) },
    legend: { top: 0 },
    grid: { left: 70, right: 20, top: 40, bottom: 40 },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    series
  }
}

export default function Stats() {
  const [annual, setAnnual] = useState([])
  const [trend, setTrend] = useState([])

  useEffect(() => {
    Promise.all([
      statsApi.annual({ yearFrom: 2023, yearTo: 2026 }),
      statsApi.trend({ yearFrom: 2023, yearTo: 2026 })
    ]).then(([a, t]) => {
      setAnnual(a)
      setTrend(t)
    })
  }, [])

  const trendOption = useMemo(() => {
    const labels = trend.map((d) => d.month.slice(0, 7))
    return lineOption(labels, [
      { name: '实发金额', type: 'line', smooth: true, data: trend.map((d) => d.netPay) },
      { name: '总薪资', type: 'line', smooth: true, data: trend.map((d) => d.totalSalary) }
    ])
  }, [trend])

  const composeOption = useMemo(() => {
    const labels = annual.map((a) => a.year)
    return lineOption(labels, [
      { name: '加项合计', type: 'bar', barWidth: 16, data: annual.map((a) => a.totalIncome) },
      { name: '扣项合计', type: 'bar', barWidth: 16, data: annual.map((a) => a.totalDeduction) }
    ])
  }, [annual])

  const companyOption = useMemo(() => {
    const labels = annual.map((a) => a.year)
    return lineOption(labels, [
      { name: '公司合计', type: 'bar', barWidth: 40, itemStyle: { color: '#00b42a' }, data: annual.map((a) => a.companyTotal) }
    ])
  }, [annual])

  const trendRef = useEChart(trendOption, [trend])
  const composeRef = useEChart(composeOption, [annual])
  const companyRef = useEChart(companyOption, [annual])

  const columns = [
    { title: '年份', dataIndex: 'year', width: 80 },
    { title: '月数', dataIndex: 'monthCount', width: 60, align: 'center' },
    { title: '加项合计', dataIndex: 'totalIncome', align: 'right', render: fmtMoney },
    { title: '扣项合计', dataIndex: 'totalDeduction', align: 'right', render: fmtMoney },
    { title: '实发金额', dataIndex: 'netPay', align: 'right', render: fmtMoney },
    { title: '实发同比', dataIndex: 'netGrowth', align: 'right', width: 100, render: (v) => <GrowthTag value={v} /> },
    { title: '总薪资', dataIndex: 'totalSalary', align: 'right', render: fmtMoney },
    { title: '总薪资同比', dataIndex: 'totalSalaryGrowth', align: 'right', width: 110, render: (v) => <GrowthTag value={v} /> },
    { title: '公司合计', dataIndex: 'companyTotal', align: 'right', render: fmtMoney },
    { title: '其他奖金', dataIndex: 'otherBonus', align: 'right', render: fmtMoney },
    { title: '年度奖金', dataIndex: 'annualBonus', align: 'right', render: fmtMoney }
  ]

  return (
    <div>
      <div className="page-card">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>年度汇总</div>
        <Table columns={columns} dataSource={annual} rowKey="year" size="small" pagination={false} scroll={{ x: 'max-content' }} />
      </div>
      <div className="page-card">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>月度趋势（实发金额 vs 总薪资）</div>
        <div ref={trendRef} style={{ height: 400 }} />
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <div className="page-card" style={{ marginBottom: 0 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>年度收入构成（加项 vs 扣项）</div>
            <div ref={composeRef} style={{ height: 340 }} />
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div className="page-card" style={{ marginBottom: 0 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>年度公司缴纳合计趋势</div>
            <div ref={companyRef} style={{ height: 340 }} />
          </div>
        </Col>
      </Row>
    </div>
  )
}
