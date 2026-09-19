const { get, post, put, del } = require('../../utils/request')

Page({
  data: {
    mode: 'my',
    cats: [],
    categoryId: null,
    status: '',
    keyword: '',
    rows: [],
    page: 1,
    hasMore: true,
    loading: false,
    showForm: false,
    catNames: ['未分类'],
    formCatIndex: 0,
    form: { id: null, title: '', summary: '', categoryId: null, tags: '', status: 'DRAFT', contentMd: '' },
    shareModal: false,
    shareArticleId: null,
    shareTitle: '',
    shareDays: 7,
    sharePassword: '',
    shareLink: ''
  },
  onLoad() {
    this.loadCats()
    this.load(true)
  },
  onPullDownRefresh() {
    Promise.all([this.loadCats(), this.load(true)]).finally(() => wx.stopPullDownRefresh())
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.load(false)
  },
  async loadCats() {
    const cats = await get('/tool/categories')
    this.setData({ cats, catNames: ['未分类'].concat(cats.map((c) => c.name)) })
  },
  async load(reset) {
    if (this.data.loading) return
    this.setData({ loading: true })
    const page = reset ? 1 : this.data.page + 1
    try {
      const params = { page, size: 20 }
      if (this.data.categoryId) params.categoryId = this.data.categoryId
      if (this.data.status) params.status = this.data.status
      if (this.data.keyword.trim()) params.keyword = this.data.keyword.trim()
      const qs = Object.keys(params).map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&')
      const path = this.data.mode === 'public' ? '/tool/articles/public' : '/tool/articles'
      const data = await get(path + '?' + qs)
      const records = (data.records || []).map((r) => ({
        ...r,
        updatedText: String(r.updatedAt || '').slice(0, 10),
        tagsArr: (r.tags || '').split(',').filter(Boolean)
      }))
      this.setData({
        rows: reset ? records : this.data.rows.concat(records),
        page,
        hasMore: page * 20 < (data.total || 0)
      })
    } finally {
      this.setData({ loading: false })
    }
  },
  onCat(e) {
    this.setData({ categoryId: e.currentTarget.dataset.id || null })
    this.load(true)
  },
  onStatus(e) {
    this.setData({ status: e.currentTarget.dataset.v })
    this.load(true)
  },
  onMode(e) {
    this.setData({ mode: e.currentTarget.dataset.v, status: '', categoryId: null, keyword: '' })
    this.load(true)
  },
  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
  },
  onSearch() {
    this.load(true)
  },
  onOpen(e) {
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${e.currentTarget.dataset.id}&public=${this.data.mode === 'public' ? 1 : 0}` })
  },
  onShare(e) {
    const r = this.data.rows.find((x) => x.id === e.currentTarget.dataset.id)
    if (!r) return
    this.setData({
      shareModal: true,
      shareArticleId: r.id,
      shareTitle: r.title,
      shareDays: 7,
      sharePassword: '',
      shareLink: r.shareToken ? `https://wei6130.top:8445/share/${r.shareToken}` : ''
    })
  },
  onShareDays(e) {
    this.setData({ shareDays: e.detail.value })
  },
  onSharePassword(e) {
    this.setData({ sharePassword: e.detail.value })
  },
  async genShare() {
    const a = await post(`/tool/articles/${this.data.shareArticleId}/share`, {
      days: Number(this.data.shareDays) || 7,
      password: this.data.sharePassword
    })
    this.setData({ shareLink: `https://wei6130.top:8445/share/${a.shareToken}` })
    wx.showToast({ title: '分享链接已生成', icon: 'success' })
  },
  copyShare() {
    if (!this.data.shareLink) return
    wx.setClipboardData({ data: this.data.shareLink })
  },
  async disableShare() {
    await del(`/tool/articles/${this.data.shareArticleId}/share`)
    this.setData({ shareLink: '', shareModal: false })
    this.load(true)
  },
  closeShare() {
    this.setData({ shareModal: false })
  },
  onLongPress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定删除该文章？',
      success: async (res) => {
        if (!res.confirm) return
        await del(`/tool/articles/${id}`)
        this.load(true)
      }
    })
  },
  openForm() {
    this.setData({
      showForm: true,
      formCatIndex: 0,
      form: { id: null, title: '', summary: '', categoryId: null, tags: '', status: 'DRAFT', contentMd: '' }
    })
  },
  onForm(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ [`form.${k}`]: e.detail.value })
  },
  onFormCat(e) {
    const idx = Number(e.detail.value)
    this.setData({ formCatIndex: idx, 'form.categoryId': idx === 0 ? null : this.data.cats[idx - 1].id })
  },
  onFormStatus(e) {
    this.setData({ 'form.status': e.currentTarget.dataset.v })
  },
  closeForm() {
    this.setData({ showForm: false })
  },
  async saveForm() {
    const f = this.data.form
    if (!f.title.trim()) {
      wx.showToast({ title: '标题必填', icon: 'none' })
      return
    }
    const payload = {
      title: f.title.trim(),
      summary: f.summary || '',
      categoryId: f.categoryId || null,
      tags: f.tags || '',
      status: f.status,
      contentMd: f.contentMd || ''
    }
    if (f.id) await put(`/tool/articles/${f.id}`, payload)
    else await post('/tool/articles', payload)
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ showForm: false })
    this.load(true)
  },
  openAi() {
    wx.navigateTo({ url: '/pages/ai-chat/ai-chat' })
  }
})
