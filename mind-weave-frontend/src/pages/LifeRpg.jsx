import { useEffect, useState } from 'react'
import { Button, Input, Modal, Popconfirm, Spin, Toast } from '@douyinfe/semi-ui'
import { IconCrown, IconDelete, IconPlus, IconRefresh, IconStar, IconTickCircle } from '@douyinfe/semi-icons'
import { toolApi } from '../api'
import '../rpg.css'

const COLORS = [
  { value: 'violet', label: '星紫' },
  { value: 'mint', label: '薄荷' },
  { value: 'coral', label: '珊瑚' },
  { value: 'gold', label: '日光' },
  { value: 'blue', label: '深海' }
]
const EMOJIS = ['✦', '📚', '🏃', '💧', '🧘', '🎯', '🌱', '🧠']
const BADGE_CATEGORIES = [
  { value: 'all', label: '全部' }, { value: 'quest', label: '行动' },
  { value: 'knowledge', label: '知识' }, { value: 'order', label: '秩序' },
  { value: 'rhythm', label: '节律' }, { value: 'growth', label: '成长' }
]

export default function LifeRpg({ initialData = null }) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(!initialData)
  const [busy, setBusy] = useState(null)
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '✦', color: 'violet' })
  const [badgeFilter, setBadgeFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    try { setData(await toolApi.rpg()) } finally { setLoading(false) }
  }
  useEffect(() => { if (!initialData) load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const createHabit = async () => {
    if (!form.name.trim()) return Toast.warning('先为这个习惯取个名字')
    setSaving(true)
    try {
      setData(await toolApi.createRpgHabit({ ...form, name: form.name.trim() }))
      setForm({ name: '', emoji: '✦', color: 'violet' })
      setVisible(false)
      Toast.success('新习惯已加入每日冒险')
    } finally { setSaving(false) }
  }

  const toggleHabit = async (habit) => {
    setBusy(habit.id)
    try {
      setData(await toolApi.toggleRpgHabit(habit.id))
      Toast.success(habit.checkedToday ? '已取消今日打卡' : `打卡成功，经验 +16`)
    } finally { setBusy(null) }
  }

  const deleteHabit = async (id) => {
    setBusy(id)
    try { setData(await toolApi.deleteRpgHabit(id)); Toast.success('习惯已移出冒险') } finally { setBusy(null) }
  }

  if (loading && !data) return <div className="rpg-loading"><Spin size="large" tip="正在读取成长轨迹" /></div>
  if (!data) return null
  const { profile, dailyQuest, habits = [], skills = [], achievements = [] } = data
  const xpPercent = Math.min(100, (profile.levelXp / profile.nextLevelXp) * 100)
  const visibleAchievements = badgeFilter === 'all' ? achievements : achievements.filter((badge) => badge.category === badgeFilter)

  return <div className="rpg-page">
    <header className="rpg-hero">
      <div className="rpg-hero-copy">
        <span className="rpg-eyebrow">LIFE RPG · 成长冒险</span>
        <h1>你做过的每一件小事，<br />都在编织更强的自己。</h1>
        <p>经验来自真实行动，不需要额外记账。完成待办、沉淀知识、整理信息与坚持习惯，都会推动这场长期冒险。</p>
        <div className="rpg-level-track" aria-label={`距离等级 ${profile.level + 1} 还有 ${profile.nextLevelXp - profile.levelXp} 经验`}>
          <div><span>LEVEL {profile.level}</span><span>{profile.levelXp} / {profile.nextLevelXp} XP</span></div>
          <i><b style={{ width: `${xpPercent}%` }} /></i>
        </div>
      </div>
      <div className="rpg-medallion" aria-label={`当前等级 ${profile.level}，称号 ${profile.title}`}>
        <span className="medallion-orbit orbit-one" /><span className="medallion-orbit orbit-two" />
        <div><IconCrown /><small>LV.</small><strong>{profile.level}</strong><span>{profile.title}</span></div>
      </div>
      <div className="rpg-hero-stats">
        <div><strong>{profile.totalXp}</strong><span>总经验</span></div>
        <div><strong>{profile.bestStreak}</strong><span>最长连击</span></div>
        <div><strong>{profile.unlockedBadges}</strong><span>已获徽章</span></div>
      </div>
    </header>

    <div className="rpg-grid">
      <section className="rpg-panel rpg-quests">
        <div className="rpg-section-head"><div><span>DAILY QUEST</span><h2>今天的冒险</h2></div><Button theme="borderless" icon={<IconPlus />} onClick={() => setVisible(true)}>添加习惯</Button></div>
        <div className={`quest-summary${dailyQuest.complete ? ' is-complete' : ''}`}>
          <span>{dailyQuest.complete ? <IconTickCircle /> : '◌'}</span>
          <div><strong>{dailyQuest.complete ? '今日习惯全部完成' : `${dailyQuest.checkedToday} / ${dailyQuest.habitTotal} 项习惯已完成`}</strong><small>{dailyQuest.activeTodos} 件待办仍在冒险清单中</small></div>
          <b>{dailyQuest.complete ? 'PERFECT' : 'TODAY'}</b>
        </div>
        <div className="habit-list">
          {habits.map(habit => <div className={`habit-row tone-${habit.color}${habit.checkedToday ? ' is-checked' : ''}`} key={habit.id}>
            <button type="button" className="habit-check" disabled={busy === habit.id} onClick={() => toggleHabit(habit)} aria-label={`${habit.checkedToday ? '取消' : '完成'} ${habit.name} 今日打卡`}>
              <span>{habit.checkedToday ? '✓' : habit.emoji}</span>
            </button>
            <button type="button" className="habit-main" disabled={busy === habit.id} onClick={() => toggleHabit(habit)}>
              <strong>{habit.name}</strong><small>{habit.streak ? `🔥 连续 ${habit.streak} 天` : '从今天开始连续记录'}</small>
            </button>
            <div className="habit-xp"><strong>{habit.totalCheckins}</strong><span>次打卡</span></div>
            <Popconfirm title="移除这个习惯？" content="相关打卡记录也会一起移除。" onConfirm={() => deleteHabit(habit.id)}><Button theme="borderless" type="tertiary" icon={<IconDelete />} aria-label={`删除 ${habit.name}`} /></Popconfirm>
          </div>)}
          {!habits.length && <button type="button" className="habit-empty" onClick={() => setVisible(true)}><span>＋</span><strong>创建第一个每日习惯</strong><small>从一件足够小、明天还愿意继续的事开始</small></button>}
        </div>
      </section>

      <section className="rpg-panel rpg-skills">
        <div className="rpg-section-head"><div><span>SKILL CONSTELLATION</span><h2>能力星图</h2></div><Button theme="borderless" icon={<IconRefresh />} loading={loading} onClick={load} aria-label="刷新能力星图" /></div>
        <div className="skill-constellation">
          <span className="skill-thread thread-a" /><span className="skill-thread thread-b" /><span className="skill-core">MW<small>成长核心</small></span>
          {skills.map((skill, index) => <div className={`skill-node skill-${index} tone-${skill.color}`} key={skill.code}>
            <span className="skill-glyph">{skill.glyph}</span>
            <div><small>LV.{skill.level}</small><strong>{skill.name}</strong><p>{skill.description}</p></div>
            <i><b style={{ width: `${(skill.levelXp / skill.nextLevelXp) * 100}%` }} /></i>
          </div>)}
        </div>
      </section>
    </div>

    <section className="rpg-panel rpg-achievements">
      <div className="rpg-section-head"><div><span>ACHIEVEMENT ARCHIVE</span><h2>成就陈列室</h2></div><span className="achievement-count">{profile.unlockedBadges} / {achievements.length} 已点亮</span></div>
      <div className="badge-filters">{BADGE_CATEGORIES.map((category) => <button type="button" className={badgeFilter === category.value ? 'is-active' : ''} key={category.value} onClick={() => setBadgeFilter(category.value)}>{category.label}</button>)}</div>
      <div className="badge-shelf">{visibleAchievements.map(badge => <article className={`${badge.unlocked ? 'is-unlocked ' : ''}rarity-${badge.rarity || 'common'}`} key={badge.code}>
        <div className="badge-medal"><span>{badge.glyph}</span>{badge.unlocked && <IconStar />}</div>
        <div><strong>{badge.name}</strong><p>{badge.description}</p><small>{badge.unlocked ? '已解锁' : `${badge.current} / ${badge.target}`}</small></div>
      </article>)}</div>
    </section>

    <Modal title="添加每日习惯" visible={visible} onOk={createHabit} confirmLoading={saving} okText="加入冒险" cancelText="取消" onCancel={() => setVisible(false)} width="min(430px, calc(100vw - 24px))">
      <div className="habit-form">
        <label>习惯名称<Input maxLength={30} showClear value={form.name} onChange={name => setForm(f => ({ ...f, name }))} placeholder="例如：阅读 20 分钟" /></label>
        <label>选择图记<div className="emoji-picker">{EMOJIS.map(emoji => <button type="button" className={form.emoji === emoji ? 'is-active' : ''} key={emoji} onClick={() => setForm(f => ({ ...f, emoji }))}>{emoji}</button>)}</div></label>
        <label>选择织线<div className="color-picker">{COLORS.map(color => <button type="button" className={`tone-${color.value}${form.color === color.value ? ' is-active' : ''}`} key={color.value} onClick={() => setForm(f => ({ ...f, color: color.value }))}><i />{color.label}</button>)}</div></label>
      </div>
    </Modal>
  </div>
}
