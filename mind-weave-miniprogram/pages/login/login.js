const { post } = require('../../utils/request')
const { getCode, silentLogin, bind, saveSession } = require('../../utils/wxauth')
const { DEFAULT_BASE } = require('../../config')

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    wxLoading: false,
    showBind: false,
    bindUser: '',
    bindPwd: '',
    base: DEFAULT_BASE
  },
  onLoad() {
    this.setData({
      username: wx.getStorageSync('salary_last_user') || '',
      base: wx.getStorageSync('salary_api_base') || DEFAULT_BASE
    })
  },
  onUsername(e) {
    this.setData({ username: e.detail.value })
  },
  onPassword(e) {
    this.setData({ password: e.detail.value })
  },
  async onLogin() {
    const { username, password } = this.data
    if (!username.trim()) {
      wx.showToast({ title: '请输入用户名', icon: 'none' })
      return
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      const data = await post('/auth/login', {
        username: username.trim(),
        password
      })
      wx.setStorageSync('salary_token', data.token)
      wx.setStorageSync('salary_user', data.user)
      wx.setStorageSync('salary_last_user', username.trim())
      getApp().globalData.user = data.user
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/home' })
      }, 400)
    } catch (e) {
      // 错误提示已由 request 统一处理
    } finally {
      this.setData({ loading: false })
    }
  },
  onWxLogin() {
    if (this.data.wxLoading) return
    this.setData({ wxLoading: true })
    wx.showLoading({ title: '微信登录中', mask: true })
    silentLogin()
      .then((res) => {
        wx.hideLoading()
        if (res.needBind) {
          this.setData({ showBind: true, wxLoading: false })
          wx.nextTick(() => {
            wx.pageScrollTo({ selector: '.bind-card', duration: 300 })
          })
          return
        }
        saveSession(res)
        wx.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/home/home' })
        }, 400)
        this.setData({ wxLoading: false })
      })
      .catch(() => {
        wx.hideLoading()
        this.setData({ wxLoading: false })
      })
  },
  onBindUser(e) {
    this.setData({ bindUser: e.detail.value })
  },
  onBindPwd(e) {
    this.setData({ bindPwd: e.detail.value })
  },
  async onBind() {
    const { bindUser, bindPwd } = this.data
    if (!bindUser.trim()) {
      wx.showToast({ title: '请输入用户名', icon: 'none' })
      return
    }
    if (!bindPwd) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '绑定中', mask: true })
    try {
      const code = await getCode()
      const res = await bind(code, bindUser.trim(), bindPwd)
      saveSession(res)
      wx.hideLoading()
      wx.showToast({ title: '绑定成功', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/home' })
      }, 400)
    } catch (e) {
      wx.hideLoading()
    }
  }
})
