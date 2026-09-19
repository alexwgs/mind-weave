const { getConfig, verify, markUnlocked } = require('../../utils/unlock')

Page({
  data: {
    type: 'pin',
    hasPin: false,
    pin: '',
    gestureDots: [],
    gestureSet: {},
    busy: false
  },
  onLoad() {
    getConfig()
      .then((cfg) => {
        const type = cfg.type || 'none'
        if (type === 'none') {
          markUnlocked()
          this.back()
          return
        }
        this.setData({ type, hasPin: !!cfg.hasPin })
      })
      .catch(() => {
        markUnlocked()
        this.back()
      })
  },
  back() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) })
  },
  onPinInput(e) {
    const v = e.detail.value
    this.setData({ pin: v })
    if (v.length === 6) {
      this.doVerify('pin', v)
    }
  },
  doVerify(type, value) {
    if (this.data.busy) return
    this.setData({ busy: true })
    verify(type, value)
      .then(() => {
        markUnlocked()
        this.back()
      })
      .catch(() => {
        this.setData({ pin: '', gestureDots: [], gestureSet: {}, busy: false })
      })
  },
  onDotTap(e) {
    const i = Number(e.currentTarget.dataset.i)
    const dots = [...this.data.gestureDots]
    if (dots.includes(i)) return
    dots.push(i)
    const set = {}
    dots.forEach((d) => {
      set[d] = true
    })
    this.setData({ gestureDots: dots, gestureSet: set })
  },
  clearGesture() {
    this.setData({ gestureDots: [], gestureSet: {} })
  },
  confirmGesture() {
    if (this.data.gestureDots.length < 4) {
      wx.showToast({ title: '至少连接 4 个点', icon: 'none' })
      return
    }
    this.doVerify('gesture', this.data.gestureDots.join(','))
  },
  startFace() {
    wx.startSoterAuthentication({
      requestAuthModes: ['fingerPrint', 'facial'],
      challenge: 'unlock-' + Date.now(),
      authContent: '验证身份以查看收支数据',
      success: () => {
        markUnlocked()
        this.back()
      },
      fail: () => {
        wx.showToast({ title: '生物识别未通过', icon: 'none' })
        if (this.data.hasPin) {
          this.setData({ type: 'pin' })
        }
      }
    })
  },
  usePin() {
    this.setData({ type: 'pin' })
  }
})
