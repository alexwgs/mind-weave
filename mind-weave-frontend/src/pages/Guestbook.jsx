import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Empty, Spin, Toast } from '@douyinfe/semi-ui'
import { IconArrowRight, IconComment, IconRefresh } from '@douyinfe/semi-icons'
import { communityApi } from '../api'
import { useAuth } from '../auth'
import { CommunityTopbar, Composer, Post } from '../components/community'
import '../community.css'

export default function Guestbook() {
  const auth = useAuth()
  const isLoggedIn = !!auth.user
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [nickname, setNickname] = useState(() => localStorage.getItem('mindweave_guest_name') || '')
  const [content, setContent] = useState('')
  const [justSubmitted, setJustSubmitted] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const page = await communityApi.guestbook({ page: 1, size: 60 })
      setEntries(page.records || [])
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 审核通过后自动出现，不用手动刷新
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, 15000)
    return () => clearInterval(timer)
  }, [load])

  const send = async () => {
    if (!isLoggedIn && (nickname.trim().length < 2 || nickname.trim().length > 24)) return Toast.warning('请填写 2-24 个字符的游客昵称')
    if (!content.trim()) return Toast.warning('先写点内容吧')
    setSending(true)
    try {
      await communityApi.postGuestbook({ nickname: nickname.trim(), content: content.trim() })
      if (!isLoggedIn) localStorage.setItem('mindweave_guest_name', nickname.trim())
      setContent('')
      setJustSubmitted(true)
      Toast.success('留言已提交，审核通过后会出现在这里')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="community-page">
      <CommunityTopbar active="guestbook" isLoggedIn={isLoggedIn} />
      <div className="community-shell">
        <section className="community-hero">
          <div>
            <span className="section-eyebrow">PUBLIC COMMONS · 留言板</span>
            <h1>留言板</h1>
            <p>留言是留给未来的一封短信。不必等对方在线，写下来，等它被读到。</p>
            <div className="community-hero-actions">
              <span className="community-status"><i />共 {loading ? '…' : entries.length} 条公开留言 · 审核后展示</span>
              <Link className="action-quiet" to="/community">去会客厅聊两句 <IconArrowRight /></Link>
            </div>
          </div>
          <div className="community-hero-card" aria-hidden="true">
            <span className="community-hero-spark">✳</span>
            <strong>写给以后</strong>
            <p>祝福、建议、想说的话都可以留下。留言会先经管理员确认一次，然后长期保存在这里。</p>
          </div>
        </section>

        <main className="community-main is-guestbook">
          <section className="community-panel community-board">
            {justSubmitted && (
              <div className="community-notice" role="status">
                <span aria-hidden="true">✳</span>
                <span>留言已送出，正在等待审核。通过后它会出现在下面的列表里，不必重复提交。</span>
              </div>
            )}

            <div className="community-stream-head">
              <div>
                <span className="section-eyebrow">GUESTBOOK</span>
                <h2>公开留言</h2>
              </div>
              <Button theme="borderless" size="small" icon={<IconRefresh />} onClick={() => load()} aria-label="刷新留言">刷新</Button>
            </div>

            <Composer
              value={content}
              onChange={setContent}
              nickname={nickname}
              onNicknameChange={setNickname}
              user={auth.user}
              sending={sending}
              onSend={send}
              maxLength={2000}
              placeholder="写下一段想留下的话…"
              reviewNote="提交后需要管理员审核，通过后公开展示。"
              actionLabel="提交留言"
            />

            <div className="community-stream is-guestbook">
              {loading
                ? <Spin />
                : entries.length
                  ? entries.map((item) => <Post key={item.id} item={item} variant="guestbook" />)
                  : (
                    <Empty
                      image={<span className="community-empty-mark" aria-hidden="true">✉</span>}
                      description={<div className="community-empty"><h3>还没有公开留言</h3><p>来写第一封吧，它会一直留在这里。</p></div>}
                    />
                  )}
            </div>
          </section>

          <aside className="community-col community-rail">
            <div className="community-panel">
              <div className="community-panel-heading">这里和会客厅有什么不同</div>
              <div className="community-rail-list">
                <p><b>会客厅</b><br />即时公开的聊天，适合随口聊。发完立刻能看到。</p>
                <p><b>留言板</b><br />一条一条留在这里的话，会经过审核再公开，存得更久。</p>
                <span className="community-rail-rule" />
                <p>昵称只在发表时使用，登录后也可以成员身份留言。</p>
                <Link className="action-quiet" to="/community">去会客厅 <IconComment size="small" /></Link>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}
