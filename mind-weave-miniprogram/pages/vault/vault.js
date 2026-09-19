const { get, post, put, del } = require('../../utils/request')

function genPwd(len = 18) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%^&*()-_=+']
  const all = sets.join('')
  const arr = sets.map((s) => s[Math.floor(Math.random() * s.length)])
  while (arr.length < len) arr.push(all[Math.floor(Math.random() * all.length)])
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
  return arr.join('')
}

Page({
  data: {
    groups: [],
    groupNames: ['未分组'],
    groupId: null,
    keyword: '',
    rows: [],
    page: 1,
    hasMore: true,
    loading: false,
    showForm: false,
    formGroupIndex: 0,
    form: { id: null, groupId: null, name: '', account: '', password: '', note: '', fields: [{ key: '', value: '' }] }
  },
  onLoad() {
    this.loadGroups()
    this.load(true)
  },
  onPullDownRefresh() {
    Promise.all([this.loadGroups(), this.load(true)]).finally(() => wx.stopPullDownRefresh())
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.load(false)
  },
  async loadGroups() {
    const groups = await get('/tool/vault/groups')
    this.setData({ groups, groupNames: ['未分组'].concat(groups.map((g) => g.name)) })
  },
  async load(reset) {
    if (this.data.loading) return
    this.setData({ loading: true })
    const page = reset ? 1 : this.data.page + 1
    try {
      const params = { page, size: 20 }
      if (this.data.groupId) params.groupId = this.data.groupId
      if (this.data.keyword.trim()) params.keyword = this.data.keyword.trim()
      const qs = Object.keys(params).map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&')
      const data = await get('/tool/vault/items?' + qs)
      const rows = (data.records || []).map((r) => ({
        ...r,
        groupName: (this.data.groups.find((g) => g.id === r.groupId) || {}).name || '未分组'
      }))
      this.setData({
        rows: reset ? rows : this.data.rows.concat(rows),
        page,
        hasMore: page * 20 < (data.total || 0)
      })
    } finally {
      this.setData({ loading: false })
    }
  },
  onGroup(e) {
    this.setData({ groupId: e.currentTarget.dataset.id || null })
    this.load(true)
  },
  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
  },
  onSearch() {
    this.load(true)
  },
  onOpen(e) {
    wx.navigateTo({ url: `/pages/vault-detail/vault-detail?id=${e.currentTarget.dataset.id}` })
  },
  onLongPress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定删除该凭证？',
      success: async (res) => {
        if (!res.confirm) return
        await del(`/tool/vault/items/${id}`)
        wx.showToast({ title: '已删除', icon: 'none' })
        this.load(true)
      }
    })
  },
  openForm() {
    const groupId = this.data.groupId
    const idx = groupId ? this.data.groups.findIndex((g) => g.id === groupId) + 1 : 0
    this.setData({
      showForm: true,
      formGroupIndex: idx,
      form: { id: null, groupId, name: '', account: '', password: '', note: '', fields: [{ key: '', value: '' }] }
    })
  },
  onForm(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ [`form.${k}`]: e.detail.value })
  },
  onFormGroup(e) {
    const idx = Number(e.detail.value)
    this.setData({ formGroupIndex: idx, 'form.groupId': idx === 0 ? null : this.data.groups[idx - 1].id })
  },
  onGenPwd() {
    const p = genPwd()
    this.setData({ 'form.password': p })
    wx.setClipboardData({ data: p })
  },
  onField(e) {
    const { i, k } = e.currentTarget.dataset
    this.setData({ [`form.fields[${i}].${k}`]: e.detail.value })
  },
  addField() {
    this.setData({ 'form.fields': [...this.data.form.fields, { key: '', value: '' }] })
  },
  removeField(e) {
    const i = e.currentTarget.dataset.i
    const fields = this.data.form.fields.filter((_, j) => j !== i)
    this.setData({ 'form.fields': fields.length ? fields : [{ key: '', value: '' }] })
  },
  closeForm() {
    this.setData({ showForm: false })
  },
  async saveForm() {
    const f = this.data.form
    if (!f.name.trim()) {
      wx.showToast({ title: '名称必填', icon: 'none' })
      return
    }
    const payload = {
      groupId: f.groupId || null,
      name: f.name.trim(),
      account: f.account || '',
      password: f.password || '',
      note: f.note || '',
      fields: f.fields.filter((x) => x.key.trim()).map((x) => ({ key: x.key.trim(), value: x.value || '' }))
    }
    if (f.id) await put(`/tool/vault/items/${f.id}`, payload)
    else await post('/tool/vault/items', payload)
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ showForm: false })
    this.load(true)
  },
  openAi() {
    wx.navigateTo({ url: '/pages/ai-chat/ai-chat' })
  }
})
