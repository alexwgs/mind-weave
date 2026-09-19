const { get, post } = require('../../utils/request')
const { downloadAttachment } = require('../../utils/attachment')

Page({
  data: {
    id: null,
    item: null,
    revealed: false,
    accountText: '',
    passwordText: '',
    fieldsText: [],
    showPin: false,
    pin: '',
    verifyLoading: false,
    attachments: []
  },
  onLoad(query) {
    this.setData({ id: query.id })
    this.load()
  },
  async load() {
    const item = await get(`/tool/vault/items/${this.data.id}`)
    this.setData({
      item: { ...item, lastViewText: item.lastViewAt ? String(item.lastViewAt).slice(0, 19).replace('T', ' ') : '' },
      accountText: item.accountMasked || '',
      passwordText: item.passwordMasked || '',
      fieldsText: (item.fields || []).map((f) => ({ key: f.key, value: f.value || '' }))
    })
    const attachments = await get(`/tool/attachments?bizType=VAULT&bizId=${this.data.id}`)
    this.setData({ attachments: attachments.map((a) => ({ ...a, sizeText: a.sizeBytes ? (a.sizeBytes / 1024).toFixed(0) : '0' })) })
  },
  openPin() {
    this.setData({ showPin: true, pin: '' })
  },
  onPin(e) {
    this.setData({ pin: e.detail.value })
  },
  async verifyAndReveal() {
    if (!this.data.pin) {
      wx.showToast({ title: '请输入 PIN 码', icon: 'none' })
      return
    }
    this.setData({ verifyLoading: true })
    try {
      await post('/tool/vault/pin/verify', { pin: this.data.pin })
      const plain = await get(`/tool/vault/items/${this.data.id}/reveal`)
      this.setData({
        showPin: false,
        revealed: true,
        accountText: plain.account || '',
        passwordText: plain.password || '',
        fieldsText: (plain.fields || []).map((f) => ({ key: f.key, value: f.value || '' }))
      })
      // 5 秒后自动隐藏
      setTimeout(() => {
        const item = this.data.item
        this.setData({
          revealed: false,
          accountText: item.accountMasked || '',
          passwordText: item.passwordMasked || '',
          fieldsText: (item.fields || []).map((f) => ({ key: f.key, value: f.value || '' }))
        })
      }, 5000)
    } catch (e) {
      // 错误提示已统一处理
    } finally {
      this.setData({ verifyLoading: false })
    }
  },
  onCopy(e) {
    const v = e.currentTarget.dataset.v || ''
    if (!v) return
    wx.setClipboardData({ data: v })
  },
  async previewImage(e) {
    const id = e.currentTarget.dataset.id
    try {
      const tmp = await downloadAttachment(id)
      wx.previewImage({ urls: [tmp] })
    } catch (err) {
      wx.showToast({ title: '预览失败', icon: 'none' })
    }
  }
})
