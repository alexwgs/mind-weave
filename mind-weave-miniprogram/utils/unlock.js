const { get, put, post } = require('./request')

function getConfig() {
  return get('/tool/unlock/config', true)
}

function saveConfig(type, pin, gesture) {
  return put('/tool/unlock/config', { type, pin, gesture })
}

function verify(type, value) {
  return post('/tool/unlock/verify', { type, value })
}

function markUnlocked() {
  getApp().globalData.unlockUntil = Date.now() + 10 * 60 * 1000
}

function isUnlocked() {
  const u = getApp().globalData.unlockUntil
  return !!u && u > Date.now()
}

// 进入受保护页面时调用：未解锁则跳转解锁页
function ensureUnlocked() {
  if (isUnlocked()) return true
  const app = getApp()
  getConfig()
    .then((cfg) => {
      if (!cfg || cfg.type === 'none') {
        markUnlocked()
        return
      }
      if (app.globalData._unlockNav) return
      app.globalData._unlockNav = true
      wx.navigateTo({
        url: '/pages/unlock/unlock',
        complete: () => {
          app.globalData._unlockNav = false
        }
      })
    })
    .catch(() => {
      markUnlocked()
    })
  return false
}

module.exports = { getConfig, saveConfig, verify, markUnlocked, isUnlocked, ensureUnlocked }
