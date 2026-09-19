const { get, put, post } = require('../../utils/request')
const { getConfig, saveConfig } = require('../../utils/unlock')

Page({
  data: {
    barkUrl: '',
    digestTime: '',
    pin: '',
    pin2: '',
    saving: false,
    uType: 'none',
    uPin: '',
    uPin2: '',
    uGestureDots: [],
    uGestureSet: {},
    uGesture: ''
  },
  onLoad() {
    this.load()
  },
  async load() {
    const s = await get('/tool/settings')
    this.setData({ barkUrl: s.barkUrl || '', digestTime: s.digestTime || '' })
    getConfig().then((cfg) => {
      if (cfg && cfg.type) this.setData({ uType: cfg.type })
    }).catch(() => {})
  },
  onBark(e) {
    this.setData({ barkUrl: e.detail.value })
  },
  onDigest(e) {
    this.setData({ digestTime: e.detail.value })
  },
  onPin(e) {
    this.setData({ pin: e.detail.value })
  },
  onPin2(e) {
    this.setData({ pin2: e.detail.value })
  },
  async save() {
    this.setData({ saving: true })
    try {
      await put('/tool/settings', { barkUrl: this.data.barkUrl.trim(), digestTime: this.data.digestTime.trim() })
      wx.showToast({ title: '已保存', icon: 'success' })
    } finally {
      this.setData({ saving: false })
    }
  },
  async testBark() {
    try {
      const ok = await post('/tool/settings/bark-test', { barkUrl: this.data.barkUrl.trim() })
      wx.showToast({ title: ok ? '推送成功' : '推送失败', icon: ok ? 'success' : 'none' })
    } catch (e) {
      // 已统一提示
    }
  },
  async savePin() {
    if (this.data.pin.length < 4) {
      wx.showToast({ title: 'PIN 码至少 4 位', icon: 'none' })
      return
    }
    if (this.data.pin !== this.data.pin2) {
      wx.showToast({ title: '两次输入不一致', icon: 'none' })
      return
    }
    await put('/tool/vault/pin', { pin: this.data.pin })
    wx.showToast({ title: 'PIN 已设置', icon: 'success' })
    this.setData({ pin: '', pin2: '' })
  },
  onUType(e) {
    this.setData({ uType: e.currentTarget.dataset.v })
  },
  onUPin(e) {
    this.setData({ uPin: e.detail.value })
  },
  onUPin2(e) {
    this.setData({ uPin2: e.detail.value })
  },
  onUDotTap(e) {
    const i = Number(e.currentTarget.dataset.i)
    const dots = [...this.data.uGestureDots]
    if (dots.includes(i)) return
    dots.push(i)
    const set = {}
    dots.forEach((d) => {
      set[d] = true
    })
    this.setData({ uGestureDots: dots, uGestureSet: set })
  },
  clearUGesture() {
    this.setData({ uGestureDots: [], uGestureSet: {} })
  },
  confirmUGesture() {
    if (this.data.uGestureDots.length < 4) {
      wx.showToast({ title: '至少连接 4 个点', icon: 'none' })
      return
    }
    this.setData({ uGesture: this.data.uGestureDots.join(',') })
    wx.showToast({ title: '手势已记录', icon: 'success' })
  },
  async saveUnlock() {
    const t = this.data.uType
    if (t === 'pin') {
      if (!/^\d{6}$/.test(this.data.uPin)) {
        wx.showToast({ title: '请输入 6 位数字 PIN', icon: 'none' })
        return
      }
      if (this.data.uPin !== this.data.uPin2) {
        wx.showToast({ title: '两次输入不一致', icon: 'none' })
        return
      }
    }
    if (t === 'gesture' && !this.data.uGesture) {
      wx.showToast({ title: '请先确认手势', icon: 'none' })
      return
    }
    await saveConfig(t, t === 'pin' ? this.data.uPin : '', t === 'gesture' ? this.data.uGesture : '')
    wx.showToast({ title: '解锁设置已保存', icon: 'success' })
  }
})
