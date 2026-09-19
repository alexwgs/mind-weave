const { post } = require('../../utils/request')

const SUGGESTIONS = [
  '帮我新建一个待办：明天上午交周报',
  '查询一下我的待办',
  '查询本月工资汇总',
  '帮我写一篇关于 Java 的文章并保存为草稿'
]

Page({
  data: {
    messages: [],
    input: '',
    loading: false,
    suggestions: SUGGESTIONS
  },
  onInput(e) {
    this.setData({ input: e.detail.value })
  },
  onSuggest(e) {
    this.send(e.currentTarget.dataset.s)
  },
  async send(text) {
    const content = (typeof text === 'string' ? text : this.data.input).trim()
    if (!content || this.data.loading) return
    this.setData({ input: '' })
    const history = [...this.data.messages, { role: 'user', content }]
    this.setData({ messages: history, loading: true })
    try {
      const res = await post('/ai/chat', { messages: history })
      this.setData({ messages: [...history, { role: 'assistant', content: res.reply, actions: res.actions || [] }] })
    } catch (e) {
      this.setData({ messages: [...history, { role: 'assistant', content: '抱歉，出错了：' + (e.message || '未知错误') }] })
    } finally {
      this.setData({ loading: false })
    }
  },
  clear() {
    this.setData({ messages: [] })
  }
})
