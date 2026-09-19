const { get } = require('../../utils/request')
const { fmtMoney } = require('../../utils/format')
const { drawLine, drawBar } = require('../../utils/charts')
const { ensureUnlocked } = require('../../utils/unlock')

Page({
  data: {
    loading: false,
    yearOptions: [],
    yearFromIndex: -1,
    yearToIndex: -1,
    yearFrom: '',
    yearTo: '',
    quick: 'this',
    overview: {},
    trend: [],
    annual: []
  },
  onLoad() {
    ensureUnlocked()
    const now = new Date().getFullYear()
    const options = []
    for (let y = now; y >= now - 15; y--) {
      options.push(y)
    }
    const idx = options.indexOf(now)
    this.setData({
      yearOptions: options,
      yearFromIndex: idx,
      yearToIndex: idx,
      yearFrom: now,
      yearTo: now
    })
    this.load()
  },
  onShow() {
    ensureUnlocked()
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },
  goRecords() {
    wx.navigateTo({ url: '/pages/records/records' })
  },
  goVault() {
    wx.switchTab({ url: '/pages/vault/vault' })
  },
  goArticles() {
    wx.switchTab({ url: '/pages/articles/articles' })
  },
  goTodos() {
    wx.switchTab({ url: '/pages/todos/todos' })
  },
  openAi() {
    wx.navigateTo({ url: '/pages/ai-chat/ai-chat' })
  },
  onYearFrom(e) {
    const i = Number(e.detail.value)
    this.setData({
      yearFromIndex: i,
      yearFrom: this.data.yearOptions[i],
      quick: ''
    })
    this.load()
  },
  onYearTo(e) {
    const i = Number(e.detail.value)
    this.setData({
      yearToIndex: i,
      yearTo: this.data.yearOptions[i],
      quick: ''
    })
    this.load()
  },
  onQuick(e) {
    const v = e.currentTarget.dataset.v
    const now = new Date().getFullYear()
    const options = this.data.yearOptions
    let from = now
    let to = now
    if (v === '3y') {
      from = now - 2
    }
    if (v === 'all') {
      from = options[options.length - 1]
      to = options[0]
    }
    this.setData({
      quick: v,
      yearFrom: from,
      yearTo: to,
      yearFromIndex: options.indexOf(from),
      yearToIndex: options.indexOf(to)
    })
    this.load()
  },
  async load() {
    this.setData({ loading: true })
    const { yearFrom, yearTo } = this.data
    try {
      const [overview, trend, annual] = await Promise.all([
        get(`/stats/overview?yearFrom=${yearFrom}&yearTo=${yearTo}`),
        get(`/stats/trend?yearFrom=${yearFrom}&yearTo=${yearTo}`),
        get(`/stats/annual?yearFrom=${yearFrom}&yearTo=${yearTo}`)
      ])
      this.setData({
        overview: {
          ...overview,
          rangeNetPayText: fmtMoney(overview.rangeNetPay),
          rangeTotalSalaryText: fmtMoney(overview.rangeTotalSalary)
        },
        trend,
        annual
      })
      wx.nextTick(() => {
        this.drawCharts()
      })
    } catch (e) {
      // 错误提示已统一处理
    } finally {
      this.setData({ loading: false })
    }
  },
  drawCharts() {
    const { trend, annual } = this.data
    drawLine(
      this,
      'trendCanvas',
      trend.map((p) => String(p.month).slice(0, 7)),
      trend.map((p) => Number(p.totalSalary))
    )
    drawBar(
      this,
      'annualCanvas',
      annual.map((a) => a.year),
      annual.map((a) => Number(a.totalSalary)),
      annual.map((a, i) => (i % 2 ? '#18a058' : '#0061ff'))
    )
  }
})
