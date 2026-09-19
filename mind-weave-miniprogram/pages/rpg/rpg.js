const { get, post, del } = require('../../utils/request')

const EMOJIS = ['✦', '📚', '🏃', '💧', '🧘', '🎯', '🌱', '🧠']
const COLORS = ['violet', 'mint', 'coral', 'gold', 'blue']

Page({
  data: {
    loading: true,
    profile: {},
    dailyQuest: {},
    habits: [],
    skills: [],
    achievements: [],
    xpPercent: 0,
    showCreate: false,
    habitName: '',
    habitEmoji: '✦',
    habitColor: 'violet',
    emojis: EMOJIS,
    colors: COLORS,
    saving: false,
    busy: ''
  },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    this.setData({ loading: true })
    try { this.apply(await get('/tool/rpg')) } catch (e) { /* 统一提示 */ } finally { this.setData({ loading: false }) }
  },
  apply(data) {
    const profile = data.profile || {}
    this.setData({
      profile,
      dailyQuest: data.dailyQuest || {},
      habits: data.habits || [],
      skills: data.skills || [],
      achievements: data.achievements || [],
      xpPercent: Math.min(100, Math.round((profile.levelXp || 0) / (profile.nextLevelXp || 100) * 100))
    })
  },
  openCreate() { this.setData({ showCreate: true }) },
  closeCreate() { this.setData({ showCreate: false, habitName: '', habitEmoji: '✦', habitColor: 'violet' }) },
  onHabitName(e) { this.setData({ habitName: e.detail.value }) },
  chooseEmoji(e) { this.setData({ habitEmoji: e.currentTarget.dataset.value }) },
  chooseColor(e) { this.setData({ habitColor: e.currentTarget.dataset.value }) },
  async createHabit() {
    const name = this.data.habitName.trim()
    if (!name) return wx.showToast({ title: '请填写习惯名称', icon: 'none' })
    this.setData({ saving: true })
    try {
      this.apply(await post('/tool/rpg/habits', { name, emoji: this.data.habitEmoji, color: this.data.habitColor }))
      this.closeCreate()
      wx.showToast({ title: '已加入冒险', icon: 'success' })
    } finally { this.setData({ saving: false }) }
  },
  async toggleHabit(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.busy) return
    this.setData({ busy: id })
    try {
      this.apply(await post(`/tool/rpg/habits/${id}/toggle`, {}))
      wx.showToast({ title: '成长经验已更新', icon: 'success' })
    } finally { this.setData({ busy: '' }) }
  },
  removeHabit(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '移除习惯',
      content: `确定移除“${name}”及其打卡记录吗？`,
      success: async res => {
        if (!res.confirm) return
        try { this.apply(await del(`/tool/rpg/habits/${id}`)) } catch (error) { /* 统一提示 */ }
      }
    })
  }
})
