const { get } = require('../../utils/request')
const { downloadAttachment } = require('../../utils/attachment')

const PRIORITY_LABEL = { HIGH: '高', MEDIUM: '中', LOW: '低' }

Page({
  data: {
    covers: [],
    articles: [],
    todos: [],
    rpg: null,
    loading: true,
    today: ''
  },
  onLoad() {
    const d = new Date()
    this.setData({ today: `${d.getMonth() + 1}月${d.getDate()}日` })
  },
  onShow() {
    this.load()
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },
  async load() {
    this.setData({ loading: true })
    try {
      const [covers, arts, todos, rpg] = await Promise.all([
        get('/tool/articles/covers?limit=6', true).catch(() => []),
        get('/tool/articles?status=PUBLISHED&page=1&size=6').catch(() => ({ records: [], total: 0 })),
        get('/tool/todos?status=active&page=1&size=5').catch(() => ({ records: [], total: 0 })),
        get('/tool/rpg', true).catch(() => null)
      ])
      const coverList = []
      for (const c of covers || []) {
        const idMatch = String(c.imageUrl || '').match(/(\d+)/)
        if (!idMatch) {
          coverList.push({ id: c.id, title: c.title, tmp: '', hasImage: false })
          continue
        }
        try {
          const tmp = await downloadAttachment(idMatch[1])
          coverList.push({ id: c.id, title: c.title, tmp, hasImage: true })
        } catch (e) {
          coverList.push({ id: c.id, title: c.title, tmp: '', hasImage: false })
        }
      }
      const articleList = (arts.records || []).map((a) => ({
        id: a.id,
        title: a.title,
        categoryPath: a.categoryPath || '未分类',
        updatedText: String(a.updatedAt || '').slice(0, 10)
      }))
      const todoList = (todos.records || []).map((t) => ({
        id: t.id,
        title: t.title,
        project: t.project || '',
        priText: PRIORITY_LABEL[t.priority] || '中',
        priClass: (t.priority || 'MEDIUM').toLowerCase(),
        dueText: t.dueTime ? String(t.dueTime).slice(5, 16).replace('T', ' ') : '无截止时间'
      }))
      this.setData({ covers: coverList, articles: articleList, todos: todoList, rpg })
    } catch (e) {
      // 错误提示已统一处理
    } finally {
      this.setData({ loading: false })
    }
  },
  goArticle(e) {
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${e.currentTarget.dataset.id}&public=0` })
  },
  goArticles() {
    wx.switchTab({ url: '/pages/articles/articles' })
  },
  goTodos() {
    wx.switchTab({ url: '/pages/todos/todos' })
  },
  openAi() {
    wx.navigateTo({ url: '/pages/ai-chat/ai-chat' })
  },
  goRpg() {
    wx.navigateTo({ url: '/pages/rpg/rpg' })
  }
})
