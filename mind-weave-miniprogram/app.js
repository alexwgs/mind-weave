App({
  globalData: {
    user: null
  },
  onLaunch() {
    const user = wx.getStorageSync('salary_user')
    if (user) {
      this.globalData.user = user
    }
    // 微信无感登录：已绑定则自动登录并进入首页
    const { silentLogin, saveSession } = require('./utils/wxauth')
    silentLogin()
      .then((res) => {
        if (!res.needBind && res.token) {
          saveSession(res)
          wx.reLaunch({ url: '/pages/home/home' })
        }
      })
      .catch(() => {
        // 静默失败，用户可手动登录
      })
  }
})
