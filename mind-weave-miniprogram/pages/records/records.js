const { get } = require('../../utils/request')
const { GROUPS, fmtMoney, groupTotal, fmtMonth } = require('../../utils/format')
const { ensureUnlocked } = require('../../utils/unlock')

const SORT_OPTIONS = [
  { label: '时间倒序', field: 'month', order: 'desc' },
  { label: '实发金额 ↓', field: 'netPay', order: 'desc' },
  { label: '实发金额 ↑', field: 'netPay', order: 'asc' },
  { label: '总薪资 ↓', field: 'totalSalary', order: 'desc' },
  { label: '总薪资 ↑', field: 'totalSalary', order: 'asc' }
]

Page({
  data: {
    rows: [],
    page: 1,
    size: 20,
    total: 0,
    hasMore: true,
    loading: false,
    yearOptions: [],
    yearIndex: 0,
    yearLabel: '全部年份',
    keyword: '',
    sortOptions: SORT_OPTIONS.map((s) => s.label),
    sortIndex: 0
  },
  onLoad() {
    ensureUnlocked()
    const now = new Date().getFullYear()
    const years = []
    for (let y = now; y >= now - 15; y--) {
      years.push(String(y))
    }
    this.setData({
      yearOptions: ['全部年份'].concat(years),
      yearIndex: 0,
      yearLabel: '全部年份'
    })
    this.load(true)
  },
  onShow() {
    ensureUnlocked()
  },
  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh())
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.load(false)
    }
  },
  onYear(e) {
    const i = Number(e.detail.value)
    this.setData({
      yearIndex: i,
      yearLabel: this.data.yearOptions[i]
    })
    this.load(true)
  },
  onSort(e) {
    const i = Number(e.detail.value)
    this.setData({ sortIndex: i })
    this.load(true)
  },
  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
  },
  onSearch() {
    this.load(true)
  },
  async load(reset) {
    if (this.data.loading) return
    this.setData({ loading: true })
    const page = reset ? 1 : this.data.page + 1
    try {
      const params = {
        page,
        size: this.data.size,
        sortField: SORT_OPTIONS[this.data.sortIndex].field,
        sortOrder: SORT_OPTIONS[this.data.sortIndex].order
      }
      if (this.data.yearLabel !== '全部年份') {
        params.year = Number(this.data.yearLabel)
      }
      if (this.data.keyword.trim()) {
        params.keyword = this.data.keyword.trim()
      }
      const qs = Object.keys(params)
        .map((k) => `${k}=${encodeURIComponent(params[k])}`)
        .join('&')
      const data = await get('/records?' + qs)
      const rows = (data.records || []).map((r) => this.buildRow(r))
      this.setData({
        rows: reset ? rows : this.data.rows.concat(rows),
        page,
        total: data.total || 0,
        hasMore: page * this.data.size < (data.total || 0)
      })
    } catch (e) {
      // 错误提示已统一处理
    } finally {
      this.setData({ loading: false })
    }
  },
  buildRow(r) {
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
      commentCount: r.commentCount || 0,
      netPayText: fmtMoney(r.netPay),
      extraText: fmtMoney(groupTotal(GROUPS[3], r)),
      totalText: fmtMoney(r.totalSalary),
      groupsExpanded: false,
      groups
    }
  },
  onDetail(e) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}`
    })
  },
  onToggleGroups(e) {
    const id = e.currentTarget.dataset.id
    const rows = this.data.rows.map((r) =>
      r.id === id ? { ...r, groupsExpanded: !r.groupsExpanded } : r
    )
    this.setData({ rows })
  },
  onToggleGroup(e) {
    const { id, gkey } = e.currentTarget.dataset
    const rows = this.data.rows.map((r) => {
      if (r.id !== id) return r
      const groups = r.groups.map((g) =>
        g.key === gkey ? { ...g, expanded: !g.expanded } : g
      )
      return { ...r, groups }
    })
    this.setData({ rows })
  }
})
