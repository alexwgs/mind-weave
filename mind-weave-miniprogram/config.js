/**
 * 接口配置
 *
 * 生产环境：https://wei6130.top:8445
 * 注意：微信小程序后台（开发-开发设置-服务器域名）的 request 合法域名
 * 必须配置为 https://wei6130.top:8445（域名需已完成 ICP 备案），
 * 配置后小程序只能请求该地址。
 *
 * 本地/临时调试（开发者工具中）：
 *   1) 勾选“不校验合法域名、TLS 版本以及 HTTPS 证书”；
 *   2) 或在控制台执行 wx.setStorageSync('salary_api_base', 'http://127.0.0.1:8080/api')
 *      恢复默认：wx.removeStorageSync('salary_api_base')
 */
const DEFAULT_BASE = 'https://wei6130.top:8445/api'

function getBase() {
  return wx.getStorageSync('salary_api_base') || DEFAULT_BASE
}

module.exports = {
  DEFAULT_BASE,
  getBase
}
