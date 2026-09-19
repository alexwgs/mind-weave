const { getBase } = require('../config')

function request(path, method, data, silent) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('salary_token')
    wx.request({
      url: getBase() + path,
      method: method || 'GET',
      data: data || {},
      timeout: 60000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        const body = res.data
        if (res.statusCode === 401) {
          wx.removeStorageSync('salary_token')
          wx.removeStorageSync('salary_user')
          wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/login/login' })
          }, 800)
          reject(new Error('未登录'))
          return
        }
        if (res.statusCode === 403) {
          if (!silent) wx.showToast({ title: '没有权限执行该操作', icon: 'none' })
          reject(new Error('没有权限'))
          return
        }
        if (body && typeof body.code !== 'undefined') {
          if (body.code === 0) {
            resolve(body.data)
          } else {
            if (!silent) wx.showToast({ title: body.message || '请求失败', icon: 'none' })
            reject(new Error(body.message || '请求失败'))
          }
          return
        }
        resolve(body)
      },
      fail(err) {
        if (!silent) wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' })
        reject(err)
      }
    })
  })
}

module.exports = {
  get: (path, silent) => request(path, 'GET', null, silent),
  post: (path, data) => request(path, 'POST', data),
  put: (path, data) => request(path, 'PUT', data),
  del: (path) => request(path, 'DELETE')
}
