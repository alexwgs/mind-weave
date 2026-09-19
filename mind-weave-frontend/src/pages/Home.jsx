import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Checkbox, Spin } from '@douyinfe/semi-ui'
import { IconArrowRight, IconArticle, IconClock, IconCrown, IconLock, IconPlus, IconRefresh } from '@douyinfe/semi-icons'
import dayjs from 'dayjs'
import { toolApi } from '../api'
import { useAuth } from '../auth'
import BrandMark from '../components/BrandMark'

const PRIORITY = { HIGH: '高优先级', MEDIUM: '中优先级', LOW: '低优先级' }
const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export default function Home() {
  const auth = useAuth()
  const [data, setData] = useState({})
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(null)
  const [coverIndex, setCoverIndex] = useState(0)
  const articleAccess = auth.can('articles') && auth.can('article.view')
  const vaultAccess = auth.can('vault') && auth.can('vault.view')
  const todoAccess = auth.can('todos')
  useEffect(() => {
    let live = true
    setLoading(true)
    const jobs = [
      ['rpg', () => toolApi.rpg()],
      ...(articleAccess ? [['articles', () => toolApi.articles({ page: 1, size: 4, status: 'PUBLISHED' })], ['drafts', () => toolApi.articles({ page: 1, size: 1, status: 'DRAFT' })], ['covers', () => toolApi.articleCovers({ limit: 6, carousel: true })]] : []),
      ...(vaultAccess ? [['groups', () => toolApi.vaultGroupSummary()]] : []),
      ...(todoAccess ? [['todos', () => toolApi.todos({ page: 1, size: 5, status: 'active' })]] : [])
    ]
    Promise.allSettled(jobs.map(([, run]) => run())).then(results => {
      if (!live) return
      const next = {}; const failed = []
      results.forEach((result, i) => { const key = jobs[i][0]; if (result.status === 'fulfilled') next[key] = result.value; else failed.push(key) })
      setData(next); setErrors(failed); setLoading(false)
    })
    return () => { live = false }
  }, [articleAccess, vaultAccess, todoAccess, refresh])
  const markDone = async id => {
    setBusy(id)
    try { await toolApi.toggleTodo(id); setRefresh(n => n + 1) } catch { /* 保留任务，供用户重试 */ } finally { setBusy(null) }
  }
  const now = dayjs()
  const name = auth.user?.displayName || auth.user?.username || ''
  const greeting = now.hour() < 6 ? '夜深了' : now.hour() < 12 ? '早上好' : now.hour() < 18 ? '下午好' : '晚上好'
  const cards = [
    { name: '人生 RPG', sub: '今天的行动，正在变成你的能力', value: data.rpg?.profile?.level, unit: data.rpg?.profile?.title || '成长等级', icon: IconCrown, path: '/rpg', tone: 'lilac' },
    ...(articleAccess ? [{ name: '我的知识库', sub: '写下的想法，会成为未来的灵感', value: data.articles?.total, unit: '篇已发布', icon: IconArticle, path: '/articles', tone: 'lilac' }] : []),
    ...(todoAccess ? [{ name: '日程待办', sub: '把想做的事，变成正在做的事', value: data.todos?.total, unit: '件进行中', icon: IconClock, path: '/todos', tone: 'peach' }] : []),
    ...(vaultAccess ? [{ name: '我的保险箱', sub: '重要的小秘密，安心放在这里', value: data.groups?.reduce((sum, group) => sum + Number(group.count || 0), 0), unit: '条凭证', icon: IconLock, path: '/vault', tone: 'mint' }] : [])
  ]
  const covers = data.covers || []
  const cover = covers[coverIndex % Math.max(covers.length, 1)]
  return <div className="growth-home">
    <section className="home-welcome">
      <div><div className="section-eyebrow"><span className="tiny-flower" aria-hidden="true">✳</span> 今天，也在慢慢生长</div><h1>{greeting}，{name}<span className="greeting-dot">。</span></h1><p>收集一点灵感，完成一件小事。<br className="mobile-break" />这里是你的成长空间。</p>
        <div className="welcome-actions">{auth.can('articles') && auth.can('article.create') && <Link className="action-primary" to="/article/new"><IconPlus /> 记下新想法</Link>}{auth.can('todos') && auth.can('todo.create') && <Link className="action-quiet" to="/todos">安排一件事 <IconArrowRight /></Link>}</div>
      </div>
      <div className="growth-notebook" aria-hidden="true"><span className="notebook-tab tab-mint">生活</span><span className="notebook-tab tab-peach">灵感</span><div className="notebook-cover"><span className="notebook-label">我的成长手帐</span><BrandMark /><span className="notebook-caption">一点一滴，自有回响</span><span className="notebook-rule" /></div><span className="notebook-spark">✦</span></div>
      <div className="today-bookmark"><span>{now.format('YYYY 年 M 月')}</span><strong>{now.format('DD')}</strong><span>{WEEK[now.day()]}</span><div>把今天收藏好</div></div>
    </section>
    {errors.length > 0 && <div className="home-error" role="status">部分内容暂时没有加载成功，已为你保留其他模块。<Button size="small" theme="borderless" icon={<IconRefresh />} onClick={() => setRefresh(n => n + 1)}>重新加载</Button></div>}
    <div className="home-shortcuts">{cards.map(({ name: label, sub, value, unit, icon: Icon, path, tone }) => <Link to={path} className={`home-shortcut tone-${tone}`} key={path}><div className="shortcut-heading"><span className="shortcut-icon"><Icon /></span><IconArrowRight /></div><h2>{label}</h2><p>{sub}</p><div className="shortcut-count"><strong>{loading ? '…' : value ?? '—'}</strong><span>{unit}</span></div></Link>)}</div>
    {loading ? <div className="home-loading"><Spin size="large" tip="正在整理你的空间" /></div> : <div className={`home-content-grid${!articleAccess || !todoAccess ? ' single-column' : ''}`}>
      {articleAccess && <section className="home-panel knowledge-shelf"><div className="panel-heading"><div><span className="section-eyebrow">给想法一个位置</span><h2>最近的知识积累 <span className="small-flower" aria-hidden="true">✳</span></h2></div><Link to="/articles">全部文章 <IconArrowRight /></Link></div>
        {cover && <div className="featured-note"><Link to={`/article-view/${cover.id}`}>{cover.imageUrl && <img src={cover.imageUrl} alt="" />}<span className="featured-note-body"><small>从你的文章里，再发现一点灵感</small><strong>{cover.title}</strong><span>{cover.categoryPath || '未分类'} <IconArrowRight /></span></span></Link>{covers.length > 1 && <div className="cover-controls">{covers.map((item, i) => <button key={item.id} className={i === coverIndex % covers.length ? 'is-active' : ''} aria-label={`显示封面 ${i + 1}`} onClick={() => setCoverIndex(i)} />)}</div>}</div>}
        {(data.articles?.records || []).map((article, index) => <Link key={article.id} to={`/article-view/${article.id}`} className="home-article-row"><span className={`article-spine spine-${index % 3}`}><IconArticle /></span><span className="home-article-copy"><span className="article-category">{article.categoryPath || '未分类'}</span><strong>{article.title}</strong><span>{article.summary || (article.tags ? article.tags.split(',').join(' · ') : '打开文章，继续阅读')}</span></span><span className="article-date">{dayjs(article.updatedAt).format('MM.DD')}<IconArrowRight /></span></Link>)}
        {!data.articles?.records?.length && <div className="home-empty"><IconArticle size="extra-large" /><h3>{errors.includes('articles') ? '文章暂时未能加载' : '你的知识花园，等第一颗种子'}</h3><p>读到的好观点、解决过的问题，都值得记下来。</p>{auth.can('article.create') && <Link to="/article/new">开始写一篇 →</Link>}</div>}
        {Number(data.drafts?.total) > 0 && <Link className="draft-strip" to="/articles?status=DRAFT"><span>还有 <b>{data.drafts.total}</b> 篇草稿，等你继续写</span><IconArrowRight /></Link>}
      </section>}
      {todoAccess && <section className="home-panel next-up"><div className="panel-heading"><div><span className="section-eyebrow">一步一步来</span><h2>接下来做什么</h2></div><Link to="/todos" aria-label="查看全部待办"><IconArrowRight /></Link></div><div className="agenda-intro"><span className="agenda-dot" /> {data.todos?.total ?? '—'} 件待办进行中 <span>按截止时间排列</span></div>
        {(data.todos?.records || []).map(todo => <div className="home-todo-row" key={todo.id}><Checkbox aria-label={`完成 ${todo.title}`} checked={!!todo.done} disabled={!auth.can('todo.edit') || busy === todo.id} onChange={() => markDone(todo.id)} /><Link to="/todos"><strong>{todo.title}</strong><span className={todo.dueTime && dayjs(todo.dueTime).isBefore(now) ? 'overdue-text' : ''}>{todo.dueTime ? `${dayjs(todo.dueTime).format('MM月DD日 HH:mm')}${dayjs(todo.dueTime).isBefore(now) ? ' · 已逾期' : ''}` : '暂未设置截止时间'}</span></Link><span className={`priority-dot priority-${todo.priority}`} title={PRIORITY[todo.priority]} /></div>)}
        {!data.todos?.records?.length && <div className="home-empty"><span className="done-flower" aria-hidden="true">✿</span><h3>{errors.includes('todos') ? '待办暂时未能加载' : '此刻，给自己一点留白'}</h3><p>有新的计划时，随手记在这里。</p></div>}
        {auth.can('todo.create') && <Link className="add-agenda" to="/todos"><IconPlus /> 添加一个小计划</Link>}
      </section>}
    </div>}
    {vaultAccess && !loading && <section className="vault-ribbon"><span className="vault-ribbon-icon"><IconLock /></span><div><strong>重要凭证，井井有条</strong><p>{(data.groups || []).filter(group => group.count > 0).slice(0, 4).map(group => `${group.name} ${group.count}`).join('　·　') || '按分组收好你的账号与凭证'}</p></div><Link to="/vault">打开保险箱 <IconArrowRight /></Link></section>}
    {!cards.length && <div className="home-panel home-empty"><h2>欢迎来到你的空间</h2><p>可访问的功能会显示在左侧导航中。</p></div>}
  </div>
}
