import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconArrowRight, IconSearch } from '@douyinfe/semi-icons'
import { toolApi } from '../api'
import { useAuth } from '../auth'
import MyceliumCanvas, { colorForCategory } from '../components/MyceliumCanvas'
import PublicNav from '../components/PublicNav'
import '../mycelium.css'

const PAGE_SIZE = 9

/* 知识库把文章分类组织成一棵树，展示时去掉前导斜杠更像野外记录里的生境路径 */
const cleanPath = (path) => {
  const p = String(path || '').trim()
  return p ? p.replace(/^\/+/, '') : '未归类'
}

const formatDate = (value) => {
  const raw = String(value || '')
  const m = raw.match(/(\d{4})[-/](\d{2})[-/](\d{2})/)
  return m ? `${m[1]}.${m[2]}.${m[3]}` : '—'
}

/* 用新鲜度代替抽象的浏览量：越近的笔记，菌丝越亮 */
const freshness = (value) => {
  const raw = String(value || '')
  const m = raw.match(/(\d{4})[-/](\d{2})[-/](\d{2})/)
  if (!m) return { days: null, label: '日期未知', level: 0.3, stale: true }
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(then.getTime())) return { days: null, label: '日期未知', level: 0.3, stale: true }
  const days = Math.max(0, Math.round((Date.now() - then.getTime()) / 86400000))
  if (days <= 7) return { days, label: days <= 1 ? '刚刚更新' : `${days} 天前更新`, level: 1, stale: false }
  if (days <= 45) return { days, label: `${days} 天前更新`, level: 0.7, stale: false }
  if (days < 365) return { days, label: `${Math.round(days / 30)} 个月前更新`, level: 0.42, stale: true }
  return { days, label: `${(days / 365).toFixed(1)} 年前更新`, level: 0.25, stale: true }
}

const splitTags = (tags) => String(tags || '').split(',').map((t) => t.trim()).filter(Boolean)

/* 部分笔记的摘要里存的是 Markdown 源码，转义符和换行会原样露出来，这里压成一句话 */
const cleanSummary = (value) => String(value || '')
  .replace(/\\r\\n|\\n|\\r/g, ' ')
  .replace(/\\[tn]/g, ' ')
  .replace(/\\([`*_#[\]()~>|-])/g, '$1')
  .replace(/[*_`>#]+/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const reAvail = () => new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

export default function Blog() {
  const auth = useAuth()
  const [articles, setArticles] = useState([])
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [taxon, setTaxon] = useState(null)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const fieldRef = useRef(null)

  const load = async () => {
    setLoading(true)
    setFailed(false)
    try {
      // 站点规模是个人知识库级别，一次取全量后在前端聚合，比请求-响应往返更快
      const data = await toolApi.publicArticles({ page: 1, size: 200 })
      const list = (data && data.records) || []
      setArticles(list)
      const counts = new Map()
      list.forEach((a) => {
        const key = cleanPath(a.categoryPath)
        counts.set(key, (counts.get(key) || 0) + 1)
      })
      setTopics([...counts.entries()].map(([name, count]) => ({ name, count })))
    } catch {
      setFailed(true)
      setArticles([])
      setTopics([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setVisible(PAGE_SIZE) }, [taxon, query])

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles.filter((a) => {
      if (taxon && cleanPath(a.categoryPath) !== taxon) return false
      if (!q) return true
      return [a.title, a.summary, a.tags, a.categoryPath]
        .some((f) => String(f || '').toLowerCase().includes(q))
    })
  }, [articles, taxon, query])
  const filtered = Boolean(taxon || query.trim())

  const stats = useMemo(() => {
    const views = articles.reduce((sum, a) => sum + (Number(a.viewCount) || 0), 0)
    const latest = articles.reduce((best, a) => {
      const t = String(a.updatedAt || a.createdAt || '')
      return t > best ? t : best
    }, '')
    return { total: articles.length, topics: topics.length, views, latest }
  }, [articles, topics])

  const submitSearch = (e) => {
    e?.preventDefault()
    setQuery(draft.trim())
    setTaxon(null)
    fieldRef.current?.blur()
  }

  const pickTopic = (name) => {
    setTaxon(name === taxon ? null : name)
    setQuery('')
    setDraft('')
  }

  const clearAll = () => {
    setTaxon(null)
    setQuery('')
    setDraft('')
  }

  const topicNames = useMemo(() => topics.map((t) => t.name), [topics])
  const titleChars = [...'把学到的，长成自己的']

  return (
    <div className="mycelium-root">
      <div className="mycelium-shell">
        <PublicNav active="blog" isLoggedIn={!!auth.user} />

        <section className="mycelium-hero">
          <MyceliumCanvas focusCategory={taxon} categories={topicNames} />

          <div className="mycelium-hero-inner">
            <span className="mycelium-eyebrow">
              <i />
              个人知识花园 · 公开笔记
            </span>

            <h1 className="mycelium-title">
              {titleChars.map((ch, i) => (
                <span key={`${ch}-${i}`} className="my-char" style={{ '--i': i }}>{ch}</span>
              ))}
            </h1>

            <p className="mycelium-lede">
              这里放的是我在工作里真正踩过、拆过、又复述过一遍的东西：<b>行内工具接入</b>、<b>AI 编排</b>、
              <b>前端迁移</b>，以及那些没人会写进文档的坑。
              每一篇都还在继续生长 —— 想到新的就回来补一句。
            </p>

            <form className="mycelium-search" onSubmit={submitSearch} role="search">
              <IconSearch />
              <input
                ref={fieldRef}
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="搜标题、摘要或标签…"
                aria-label="搜索文章"
              />
              <button type="submit">寻找</button>
            </form>

            <div className="mycelium-stats">
              <div className="mycelium-stat">
                <span className="mycelium-stat-num">{loading ? '—' : stats.total}</span>
                <span className="mycelium-stat-label">篇公开笔记</span>
              </div>
              <div className="mycelium-stat">
                <span className="mycelium-stat-num">{loading ? '—' : stats.topics}</span>
                <span className="mycelium-stat-label">个知识群落</span>
              </div>
              <div className="mycelium-stat">
                <span className="mycelium-stat-num">{loading ? '—' : formatDate(stats.latest)}</span>
                <span className="mycelium-stat-label">最近一次生长</span>
              </div>
            </div>
          </div>
        </section>

        <main className="mycelium-network" id="network">
          <div className="mycelium-network-inner">
            <div className="mycelium-network-head">
              <div>
                <h2>知识群落</h2>
                <p>每篇笔记都长在某条根上。先挑一个群落，或者直接往下翻全部标本。</p>
              </div>
              <span className="mycelium-count">
                {loading ? '正在清点…' : filtered ? `筛出 ${matched.length} / ${stats.total} 篇` : `共 ${stats.total} 篇`}
              </span>
            </div>

            <div className="mycelium-taxa" role="group" aria-label="按知识群落筛选">
              <button
                type="button"
                className={`mycelium-taxon${!taxon ? ' is-active' : ''}`}
                style={{ color: '#4fd39a' }}
                onClick={() => pickTopic(null)}
                aria-pressed={!taxon}
              >
                <i style={{ background: 'currentColor' }} />
                全部群落
                <em>{stats.total}</em>
              </button>
              {topics.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  className={`mycelium-taxon${taxon === t.name ? ' is-active' : ''}`}
                  style={{ color: colorForCategory(t.name) }}
                  onClick={() => pickTopic(t.name)}
                  aria-pressed={taxon === t.name}
                >
                  <i style={{ background: 'currentColor' }} />
                  {t.name}
                  <em>{t.count}</em>
                </button>
              ))}
            </div>

            <div className="mycelium-specimens">
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="mycelium-skeleton" aria-hidden="true" />
              ))}

              {!loading && failed && (
                <div className="mycelium-state" role="alert">
                  <h3>没能连上知识库</h3>
                  <p>可能是网络暂时不通，或者服务正在重启。稍等一下再试一次就好。</p>
                  <button type="button" onClick={load}>重新加载</button>
                </div>
              )}

              {!loading && !failed && matched.length === 0 && (
                <div className="mycelium-state">
                  <h3>{filtered ? '这个群落里还没有笔记' : '花园还是空的'}</h3>
                  <p>
                    {filtered
                      ? '换个群落看看，或者清掉筛选条件浏览全部笔记。'
                      : '等第一篇公开笔记发布后，这里会长出第一丛菌丝。'}
                  </p>
                  {filtered && <button type="button" onClick={clearAll}>查看全部笔记</button>}
                </div>
              )}

              {!loading && !failed && matched.slice(0, visible).map((a, i) => {
                const topic = cleanPath(a.categoryPath)
                const fresh = freshness(a.updatedAt || a.createdAt)
                const tags = splitTags(a.tags)
                const summary = cleanSummary(a.summary)
                return (
                  <Link
                    key={a.id}
                    to={`/blog/${a.id}`}
                    className="mycelium-card is-in"
                    style={{ '--taxon': colorForCategory(topic), '--d': `${(i % PAGE_SIZE) * 70}ms` }}
                  >
                    <span className="mycelium-card-spine" aria-hidden="true" />
                    <div className="mycelium-card-top">
                      <span className="mycelium-taxon-tag">{topic}</span>
                      {a.isFeatured === 1 && <span className="mycelium-featured">精选</span>}
                      {a.shared === false && <span className="mycelium-locked-tag">仅预览</span>}
                    </div>
                    <h3>{a.title}</h3>
                    {summary
                      ? <p className="mycelium-card-summary">{summary}</p>
                      : <p className="mycelium-card-summary is-empty">这篇笔记还没有写摘要，点开直接看正文。</p>}
                    <div className="mycelium-card-foot">
                      <span className={`mycelium-growth${fresh.stale ? ' is-stale' : ''}`}>
                        <i style={{ '--fresh': fresh.level }} />
                        {fresh.label}
                      </span>
                      <span className="my-dot" />
                      <span>{formatDate(a.updatedAt || a.createdAt)}</span>
                      {tags.length > 0 && <><span className="my-dot" /><span>{tags.slice(0, 2).join(' · ')}</span></>}
                      <span className="mycelium-card-arrow"><IconArrowRight size="small" /></span>
                    </div>
                  </Link>
                )
              })}
            </div>

            {!loading && !failed && matched.length > visible && (
              <div className="mycelium-more">
                <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  继续往下看 · 还有 {matched.length - visible} 篇
                </button>
              </div>
            )}
          </div>
        </main>

        <footer className="mycelium-footer">
          <div className="mycelium-footer-inner">
            <span>知识花园 · 个人笔记</span>
            <span className="my-spacer" />
            <Link to="/login">进入工作台</Link>
            <span>可用 {reAvail()}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
