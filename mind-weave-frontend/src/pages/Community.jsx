import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Empty, Spin, Toast } from '@douyinfe/semi-ui'
import { IconArrowRight, IconMail, IconRefresh } from '@douyinfe/semi-icons'
import { communityApi } from '../api'
import { useAuth } from '../auth'
import { CommunityTopbar, Composer, Post } from '../components/community'
import '../community.css'

export default function Community() {
  const auth = useAuth()
  const isLoggedIn = !!auth.user
  const [rooms, setRooms] = useState([])
  const [roomId, setRoomId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [nickname, setNickname] = useState(() => localStorage.getItem('mindweave_guest_name') || '')
  const [content, setContent] = useState('')
  const [mineIds, setMineIds] = useState([])
  const streamRef = useRef(null)

  useEffect(() => {
    communityApi.rooms()
      .then((items) => {
        setRooms(items)
        setRoomId((current) => current || items[0]?.id || null)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadMessages = useCallback(async (quiet = false) => {
    if (!roomId) return
    if (!quiet) setLoading(true)
    try {
      const page = await communityApi.messages(roomId, { page: 1, size: 80 })
      // 接口按时间倒序返回，会客厅按对话顺序阅读
      setMessages([...(page.records || [])].reverse())
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [roomId])

  useEffect(() => { loadMessages() }, [loadMessages])

  // 会客厅是活的空间：静默轮询，不打断阅读
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages(true)
    }, 6000)
    return () => clearInterval(timer)
  }, [loadMessages])

  // 新消息落在底部，跟随到最后
  useEffect(() => {
    const node = streamRef.current
    if (!node) return
    const timer = setTimeout(() => { node.scrollTop = node.scrollHeight }, 60)
    return () => clearTimeout(timer)
  }, [messages.length, roomId, loading])

  const activeRoom = useMemo(() => rooms.find((room) => room.id === roomId), [rooms, roomId])
  const displayName = auth.user?.displayName || auth.user?.username || nickname.trim()

  const send = async () => {
    if (!roomId) return Toast.warning('请先选择一个房间')
    if (!isLoggedIn && (nickname.trim().length < 2 || nickname.trim().length > 24)) return Toast.warning('请填写 2-24 个字符的游客昵称')
    if (!content.trim()) return Toast.warning('先写点内容吧')
    setSending(true)
    try {
      const item = await communityApi.postMessage(roomId, { nickname: nickname.trim(), content: content.trim() })
      if (!isLoggedIn) localStorage.setItem('mindweave_guest_name', nickname.trim())
      setMessages((items) => [...items, item])
      setMineIds((ids) => [...ids, item.id])
      setContent('')
      Toast.success('已发言，大家都能看到了')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="community-page">
      <div className="community-shell">
        <CommunityTopbar active="community" isLoggedIn={isLoggedIn} />

        <section className="community-hero">
          <div>
            <span className="section-eyebrow">PUBLIC COMMONS · 会客厅</span>
            <h1>织友会客厅</h1>
            <p>聊天是当下的相遇。挑一个房间坐下来，说句话就走，也不用等谁审核。</p>
            <div className="community-hero-actions">
              <span className="community-status is-live"><i />{rooms.length ? `${rooms.length} 个房间开放中 · 发言即时可见` : '正在打开房间'}</span>
              <Link className="action-quiet" to="/guestbook">去留言板留句话 <IconArrowRight /></Link>
            </div>
          </div>
          <div className="community-hero-card" aria-hidden="true">
            <span className="community-hero-spark">✳</span>
            <strong>这里不谈正事</strong>
            <p>最近读到的一句话、今天做成的一件小事，都可以丢进房间。留言板留给更郑重的表达。</p>
          </div>
        </section>

        <main className="community-main is-chat">
          <aside className="community-panel community-rooms">
            <div className="community-panel-heading">开放房间</div>
            <div className="community-room-list">
              {rooms.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  className={room.id === roomId ? 'is-active' : ''}
                  aria-current={room.id === roomId}
                  onClick={() => setRoomId(room.id)}
                >
                  <i />
                  <span>
                    <strong>{room.name}</strong>
                    <small>{room.description || '一起聊聊'}</small>
                  </span>
                </button>
              ))}
            </div>
            {!rooms.length && !loading && <p className="community-rail-empty">还没有开放的房间。管理员可以在后台「聊天室房间」里创建。</p>}
          </aside>

          <section className="community-panel community-board">
            <div className="community-stream-head">
              <div>
                <span className="section-eyebrow">ROOM</span>
                <h2>{activeRoom?.name || '聊天室'}</h2>
              </div>
              <div className="community-head-meta">
                <span className="community-status is-live"><i />即时公开</span>
                <Button theme="borderless" size="small" icon={<IconRefresh />} onClick={() => loadMessages()} aria-label="刷新消息">刷新</Button>
              </div>
            </div>

            <div className="community-stream" ref={streamRef}>
              {loading
                ? <Spin />
                : messages.length
                  ? messages.map((item) => <Post key={item.id} item={item} mine={mineIds.includes(item.id)} />)
                  : (
                    <Empty
                      image={<span className="community-empty-mark" aria-hidden="true">✳</span>}
                      description={<div className="community-empty"><h3>{activeRoom ? '这个房间还很安静' : '还没有开放的房间'}</h3><p>说第一句话，把这里点亮。</p></div>}
                    />
                  )}
            </div>

            <Composer
              value={content}
              onChange={setContent}
              nickname={nickname}
              onNicknameChange={setNickname}
              user={auth.user}
              sending={sending}
              onSend={send}
              maxLength={1000}
              placeholder={activeRoom ? `在「${activeRoom.name}」说点什么…` : '先选择一个房间…'}
              reviewNote="发送后立即公开，管理员可在后台删除。"
              actionLabel="发言"
            />
          </section>

          <aside className="community-col community-rail">
            <div className="community-panel">
              <div className="community-panel-heading">房间说明</div>
              <div className="community-rail-list">
                <p>{activeRoom?.description || '选择一个房间后，这里会显示它的说明。'}</p>
                <span className="community-rail-rule" />
                <p><b>无需审核</b><br />消息发送后立即出现在房间底部，管理员不会先看一遍。</p>
                <p><b>可以删除</b><br />如果内容不合适，管理员可以在后台直接删除。</p>
              </div>
            </div>
            <div className="community-panel">
              <div className="community-panel-heading">想认真说点什么？</div>
              <div className="community-rail-list">
                <p>留言板上的留言会先经过一次审核再公开，适合写长一点、留得久一点的话。</p>
                <Link className="action-quiet" to="/guestbook">打开留言板 <IconMail size="small" /></Link>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}
