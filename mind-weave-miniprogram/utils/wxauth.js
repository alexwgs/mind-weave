const { post } = require('./request')

function getCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (!res.code) {
          reject(new Error('获取微信登录凭证失败'))
          return
        }
        resolve(res.code)
      },
      fail: reject
    })
  })
}

function silentLogin() {
  return getCode().then((code) => post('/auth/wx-login', { code }))
}

function bind(code, username, password) {
  return post('/auth/wx-bind', { code, username, password })
}

function saveSession(data) {
  if (!data || data.needBind || !data.token) return
  wx.setStorageSync('salary_token', data.token)
  wx.setStorageSync('salary_user', data.user)
  getApp().globalData.user = data.user
}

module.exports = { getCode, silentLogin, bind, saveSession }
