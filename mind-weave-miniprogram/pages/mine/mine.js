const { put } = require('../../utils/request')

const ROLE_LABELS = {
  ADMIN: '管理员',
  MANAGER: '经理',
  USER: '普通用户'
}

Page({
  data: {
    user: {},
    userInitial: '',
    roleLabel: '',
    showPwd: false,
    oldPwd: '',
    newPwd: '',
    confirmPwd: '',
    pwdLoading: false
  },
  onShow() {
    const user = wx.getStorageSync('salary_user') || getApp().globalData.user || {}
    this.setData({
      user,
      userInitial: (user.displayName || user.username || '用').slice(0, 1),
      roleLabel: ROLE_LABELS[user.role] || user.role || ''
    })
  },
  onTogglePwd() {
    this.setData({ showPwd: !this.data.showPwd })
  },
  goSalary() {
    wx.navigateTo({ url: '/pages/salary/salary' })
  },
  goRecords() {
    wx.navigateTo({ url: '/pages/records/records' })
  },
  openAi() {
    wx.navigateTo({ url: '/pages/ai-chat/ai-chat' })
  },
  onOldPwd(e) {
    this.setData({ oldPwd: e.detail.value })
  },
  onNewPwd(e) {
    this.setData({ newPwd: e.detail.value })
  },
  onConfirmPwd(e) {
    this.setData({ confirmPwd: e.detail.value })
  },
  async onChangePwd() {
    const { oldPwd, newPwd, confirmPwd } = this.data
    if (!oldPwd || !newPwd) {
      wx.showToast({ title: '请填写完整', icon: 'none' })
      return
    }
    if (newPwd !== confirmPwd) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }
    if (newPwd.length < 6) {
      wx.showToast({ title: '新密码至少 6 位', icon: 'none' })
      return
    }
    this.setData({ pwdLoading: true })
    try {
      await put('/auth/password', {
        oldPassword: oldPwd,
        newPassword: newPwd
      })
      wx.showToast({ title: '修改成功，请重新登录', icon: 'success' })
      setTimeout(() => this.logout(), 800)
    } catch (e) {
      // 错误提示已统一处理
    } finally {
      this.setData({ pwdLoading: false })
    }
  },
  onAbout() {
    wx.showModal({
      title: '关于',
      content: 'MindWeave · 织脑 v1.0.0\n第二大脑与 Web 端实时同步',
      showCancel: false
    })
  },
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) this.logout()
      }
    })
  },
  logout() {
    wx.removeStorageSync('salary_token')
    wx.removeStorageSync('salary_user')
    getApp().globalData.user = null
    wx.reLaunch({ url: '/pages/login/login' })
  }
})
