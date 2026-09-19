const { get } = require('../../utils/request')
const { GROUPS, fmtMoney, groupTotal, fmtMonth, fieldLabel } = require('../../utils/format')

Page({
  data: {
    id: null,
    rec: null,
    loading: true
  },
  onLoad(query) {
    this.setData({ id: query.id })
    this.load()
  },
  async load() {
    try {
      const r = await get(`/records/${this.data.id}`)
      this.setData({ rec: this.build(r) })
    } catch (e) {
      // 错误提示已统一处理
    } finally {
      this.setData({ loading: false })
    }
  },
  build(r) {
    const comments = r.comments || []
    const commentMap = {}
    comments.forEach((c) => {
      commentMap[c.fieldCode] = true
    })
    const groups = GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      tint: g.tint,
      totalText: fmtMoney(groupTotal(g, r)),
      expanded: g.key === 'income',
      fields: g.fields.map((f) => ({
        key: f.key,
        label: f.label,
        valueText: fmtMoney(Number(r[f.key]) || 0),
        hasComment: !!commentMap[f.key]
      }))
    }))
    return {
      id: r.id,
      monthLabel: fmtMonth(r.month),
      grade: r.grade || '',
      netPayText: fmtMoney(r.netPay),
      extraText: fmtMoney(groupTotal(GROUPS[3], r)),
      totalText: fmtMoney(r.totalSalary),
      totalIncomeText: fmtMoney(r.totalIncome),
      totalDeductionText: fmtMoney(r.totalDeduction),
      companyTotalText: fmtMoney(r.companyTotal),
      groups,
      comments: comments.map((c) => ({
        id: c.id,
        fieldLabel: fieldLabel(c.fieldCode),
        content: c.content,
        author: c.author || '',
        createdAtText: (c.createdAt || '').slice(0, 16)
      }))
    }
  },
  onToggle(e) {
    const key = e.currentTarget.dataset.key
    const rec = this.data.rec
    const groups = rec.groups.map((g) =>
      g.key === key ? { ...g, expanded: !g.expanded } : g
    )
    this.setData({ rec: { ...rec, groups } })
  }
})
