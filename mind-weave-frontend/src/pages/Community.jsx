import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Spin, Toast } from '@douyinfe/semi-ui'
import { IconArrowRight, IconMail, IconUserGroup } from '@douyinfe/semi-icons'
import { communityApi } from '../api'
import { useAuth } from '../auth'
import { openRoomStream, guestName, rememberGuestName, viewerId } from '../realtime'
import { ChatStream, CommunityTopbar, Composer, ViewerList } from '../components/community'
import '../community.css'

const STATUS_TEXT = {
  connecting: '连接中',
  live: '已连接',
  reconnecting: '重连中',
  polling: '轮询模式',
  closed: '已断开'
}

const TYPING_TTL_MS = 4000

export default function Community() {
  const auth = useAuth()
  const isLoggedIn = !!auth.user
  const selfId = useMemo(() => viewerId(), [])
  const [rooms, setRooms] = useState([])
  const [roomId, setRoomId] = useState(null)
  const [messages, setMessages] = useState([])
  const [viewers, setViewers] = useState([])
  const [typingMap, setTypingMap] = useState({})
  const [status, setStatus] = useState('connecting')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [nickname, setNickname] = useState(() => guestName())
  const [content, setContent] = useState('')
  const chatRef = useRef(null)
  const nicknameRef = useRef(nickname)
  nicknameRef.current = nickname
  const lastTypingSent = useRef(0)

  const displayName = auth.user?.displayName || auth.user?.username || nickname.trim()

  useEffect(() => {
    communityApi.rooms()
      .then((items) => {
        setRooms(items)
        setRoomId((current) => current || items[0]?.id || null)
      })
      .finally(() => setLoading(false))
  }, [])

  /** 拉取完整消息列表；轮询兜底与发送后对齐都走这里 */
  const reload = useCallback(async () => {
    if (!roomId) return
    const page = await communityApi.messages(roomId, { page: 1, size: 80 })
    setMessages([...(page.records || [])].reverse())
  }, [roomId])

  useEffect(() => { reload().catch(() => {}) }, [reload])

  // 实时连接：消息、在线列表、输入中提示都由服务端推送，不再轮询消息
  useEffect(() => {
    if (!roomId) return undefined
    setStatus('connecting')
    const handle = openRoomStream(roomId, {
      nickname: nicknameRef.current,
      onViewers: setViewers,
      onStatus: setStatus,
      onEvent: (event) => {
        if (event.kind === 'message' && event.message) {
          const incoming = event.message
          setMessages((items) => (items.some((item) => item.id === incoming.id) ? items : [...items, incoming]))
        } else if (event.kind === 'typing' && event.viewerId && event.viewerId !== selfId) {
          setTypingMap((map) => ({ ...map, [event.viewerId]: { name: event.name, at: Date.now() } }))
        } else if (event.kind === 'poll') {
          reload().catch(() => {})
        }
      }
    })
    // 关闭页面/切走时告知服务端，在线列表立刻少一个人，不必等心跳超时
    const leave = () => { navigator.sendBeacon?.(`/api/community/public/rooms/${roomId}/presence/leave`, new Blob([JSON.stringify({ viewerId: selfId })], { type: 'application/json' })) }
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
      handle.close()
    }
  }, [roomId, selfId, reload])

  // 输入中提示：本地按 4 秒过期，避免提示一直挂着
  const typing = useMemo(
    () => Object.entries(typingMap).filter(([, item]) => Date.now() - item.at < TYPING_TTL_MS).map(([, item]) => item.name),
    [typingMap]
  )
  useEffect(() => {
    if (!typing.length) return undefined
    const timer = setInterval(() => setTypingMap((map) => ({ ...map })), 1000)
    return () => clearInterval(timer)
  }, [typing.length])

  // 新消息进来滚动到底部
  useEffect(() => {
    const node = chatRef.current
    if (!node) return undefined
    const timer = setTimeout(() => { node.scrollTop = node.scrollHeight }, 60)
    return () => clearTimeout(timer)
  }, [messages.length, typing.length, roomId, loading])

  const activeRoom = useMemo(() => rooms.find((room) => room.id === roomId), [rooms, roomId])

  const notifyTyping = () => {
    if (!roomId) return
    const now = Date.now()
    if (now - lastTypingSent.current < 2500) return
    lastTypingSent.current = now
    communityApi.typing(roomId, { viewerId: selfId }).catch(() => {})
  }

  const send = async () => {
    if (!roomId) return Toast.warning('请先选择一个房间')
    if (!isLoggedIn && (nickname.trim().length < 2 || nickname.trim().length > 24)) return Toast.warning('请填写 2-24 个字符的游客昵称')
    if (!content.trim()) return Toast.warning('先写点内容吧')
    setSending(true)
    try {
      const item = await communityApi.postMessage(roomId, { nickname: nickname.trim(), content: content.trim() })
      if (!isLoggedIn) setNickname(rememberGuestName(nickname))
      setMessages((items) => (items.some((existing) => existing.id === item.id) ? items : [...items, item]))
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
              <span className={`community-status${status === 'live' ? ' is-live' : ''}`}>
                <i />{activeRoom ? `${activeRoom.name} · ${viewers.length} 人在线 · ${STATUS_TEXT[status] || status}` : '正在打开房间'}
              </span>
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
                <span className={`community-status${status === 'live' ? ' is-live' : ''}`}><i />{STATUS_TEXT[status] || status}</span>
              </div>
            </div>

            <div className="community-stream community-chat-scroll" ref={chatRef}>
              {loading
                ? <Spin />
                : (
                  <ChatStream
                    messages={messages}
                    viewer={displayName}
                    typing={typing}
                    emptyHint={activeRoom ? undefined : { title: '还没有开放的房间', hint: '等管理员开一个房间再来。' }}
                  />
                )}
            </div>

            <Composer
              value={content}
              onChange={setContent}
              onTyping={notifyTyping}
              nickname={nickname}
              onNicknameChange={setNickname}
              user={auth.user}
              sending={sending}
              onSend={send}
              disabled={!roomId}
              maxLength={1000}
              placeholder={activeRoom ? `在「${activeRoom.name}」说点什么…（回车发送，Shift+回车换行）` : '先选择一个房间…'}
              reviewNote="发送后立即公开，管理员可在后台删除。"
              actionLabel="发言"
            />
          </section>

          <aside className="community-col community-rail">
            <div className="community-panel">
              <div className="community-panel-heading">
                <IconUserGroup size="small" /> 在线 {viewers.length ? `· ${viewers.length}` : ''}
              </div>
              <ViewerList viewers={viewers} selfId={selfId} />
            </div>
            <div className="community-panel">
              <div className="community-panel-heading">房间说明</div>
              <div className="community-rail-list">
                <p>{activeRoom?.description || '选择一个房间后，这里会显示它的说明。'}</p>
                <span className="community-rail-rule" />
                <p><b>无需审核</b><br />消息发送后立即出现在房间底部。</p>
                <p><b>可以删除</b><br />内容不合适时，管理员可在后台直接删除。</p>
                <Link className="action-quiet" to="/guestbook">打开留言板 <IconMail size="small" /></Link>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}
