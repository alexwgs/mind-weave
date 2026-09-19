import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Modal, Spin, Toast } from '@douyinfe/semi-ui'
import { IconArrowDown, IconArrowRight, IconBell, IconVolume1, IconVolumeSilentStroked, IconUserGroup } from '@douyinfe/semi-icons'
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
  const [uploading, setUploading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('community_sound') !== 'off')
  const [notificationsOn, setNotificationsOn] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted')
  const [nickname, setNickname] = useState(() => guestName())
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [aiAgents, setAiAgents] = useState([])
  const chatRef = useRef(null)
  const nicknameRef = useRef(nickname)
  nicknameRef.current = nickname
  const lastTypingSent = useRef(0)
  const nearBottomRef = useRef(true)
  const audioRef = useRef(null)

  const displayName = auth.user?.displayName || auth.user?.username || nickname.trim()
  const activeRoom = useMemo(() => rooms.find((room) => room.id === roomId), [rooms, roomId])

  useEffect(() => {
    communityApi.rooms()
      .then((items) => {
        setRooms(items)
        setRoomId((current) => current || items[0]?.id || null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (isLoggedIn) communityApi.aiAgents().then(setAiAgents).catch(() => setAiAgents([]))
    else setAiAgents([])
  }, [isLoggedIn])

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
    let active = true
    let handle = null
    setStatus('connecting')
    const identityName = isLoggedIn
      ? (auth.user?.displayName || auth.user?.username)
      : (nicknameRef.current || '访客')
    communityApi.presence(roomId, { viewerId: selfId, name: identityName }).then(() => {
      if (!active) return
      handle = openRoomStream(roomId, {
        nickname: identityName,
        onViewers: setViewers,
        onStatus: setStatus,
        onEvent: (event) => {
          if (event.kind === 'message' && event.message) {
            const incoming = event.message
            setMessages((items) => (items.some((item) => item.id === incoming.id) ? items : [...items, incoming]))
            const fromOther = incoming.authorName !== displayName
            if (fromOther) {
              if (soundOn) playChime()
              if (document.hidden || !document.hasFocus()) {
                setUnread((count) => count + 1)
                if (notificationsOn && Notification.permission === 'granted') {
                  const notice = new Notification(`${incoming.authorName} · ${activeRoom?.name || '织友会客厅'}`, { body: incoming.content.replace(/!?\[([^\]]*)\]\(attachment:\d+[^)]*\)/g, '[$1]').slice(0, 120), tag: `community-${roomId}` })
                  notice.onclick = () => { window.focus(); notice.close() }
                }
              }
            }
          } else if (event.kind === 'deleted' && event.message?.id) {
            setMessages((items) => items.filter((item) => item.id !== event.message.id))
          } else if (event.kind === 'typing' && event.viewerId && event.viewerId !== selfId) {
            setTypingMap((map) => ({ ...map, [event.viewerId]: { name: event.name, at: Date.now() } }))
          } else if (event.kind === 'poll') {
            reload().catch(() => {})
          }
        }
      })
    }).catch(() => { if (active) setStatus('polling') })
    // 关闭页面/切走时告知服务端，在线列表立刻少一个人，不必等心跳超时
    const leave = () => { navigator.sendBeacon?.(`/api/community/public/rooms/${roomId}/presence/leave`, new Blob([JSON.stringify({ viewerId: selfId })], { type: 'application/json' })) }
    window.addEventListener('pagehide', leave)
    return () => {
      active = false
      window.removeEventListener('pagehide', leave)
      handle?.close()
    }
  }, [roomId, selfId, reload, isLoggedIn, auth.user?.displayName, auth.user?.username, displayName, soundOn, notificationsOn, activeRoom?.name])

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
    const timer = setTimeout(() => {
      if (nearBottomRef.current || unread === 0) node.scrollTo({ top: node.scrollHeight, behavior: messages.length > 1 ? 'smooth' : 'auto' })
    }, 60)
    return () => clearTimeout(timer)
  }, [messages.length, typing.length, roomId, loading, unread])

  useEffect(() => {
    const clearUnread = () => {
      if (!document.hidden) { setUnread(0); document.title = '织友会客厅 · MindWeave' }
    }
    document.addEventListener('visibilitychange', clearUnread)
    window.addEventListener('focus', clearUnread)
    return () => { document.removeEventListener('visibilitychange', clearUnread); window.removeEventListener('focus', clearUnread); document.title = 'MindWeave' }
  }, [])

  useEffect(() => {
    if (unread > 0) document.title = `(${unread}) 织友会客厅 · MindWeave`
  }, [unread])

  useEffect(() => {
    const latest = messages[messages.length - 1]
    if (!roomId || !latest?.id) return
    try {
      const key = 'mindweave_room_last_seen'
      const seen = JSON.parse(localStorage.getItem(key) || '{}') || {}
      seen[roomId] = latest.id
      localStorage.setItem(key, JSON.stringify(seen))
    } catch { /* localStorage 不可用时不影响聊天 */ }
  }, [messages, roomId])

  const notifyTyping = () => {
    if (!roomId) return
    const now = Date.now()
    if (now - lastTypingSent.current < 2500) return
    lastTypingSent.current = now
    communityApi.typing(roomId, { viewerId: selfId }).catch(() => {})
  }

  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      audioRef.current ||= new AudioContext()
      const ctx = audioRef.current
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.frequency.setValueAtTime(660, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(); oscillator.stop(ctx.currentTime + 0.23)
    } catch { /* 浏览器不支持音频时静默跳过 */ }
  }

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    localStorage.setItem('community_sound', next ? 'on' : 'off')
    if (next) playChime()
  }

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return Toast.warning('当前浏览器不支持桌面提醒')
    const permission = await Notification.requestPermission()
    setNotificationsOn(permission === 'granted')
    if (permission === 'granted') Toast.success('消息提醒已开启')
    else Toast.warning('浏览器未授予通知权限')
  }

  const scrollLatest = () => {
    const node = chatRef.current
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
    nearBottomRef.current = true
    setUnread(0)
  }

  const uploadAttachment = async (file) => {
    if (!roomId) return
    if (!isLoggedIn && (nickname.trim().length < 2 || nickname.trim().length > 24)) return Toast.warning('请先填写 2-24 个字符的游客昵称')
    setUploading(true)
    try {
      const attachment = await communityApi.uploadAttachment(roomId, file, nickname.trim())
      const safeName = (attachment.originalName || file.name).replace(/[\[\]"]/g, '')
      const mime = attachment.mime || file.type || ''
      const marker = mime.startsWith('image/')
        ? `![${safeName}](attachment:${attachment.id})`
        : mime.startsWith('video/')
          ? `@video[${safeName}](attachment:${attachment.id} "size=${attachment.sizeBytes || file.size}")`
          : `[${safeName}](attachment:${attachment.id} "size=${attachment.sizeBytes || file.size}")`
      setContent((current) => `${current}${current ? '\n' : ''}${marker}`)
      Toast.success('附件已加入消息，点击“发言”发送')
    } finally { setUploading(false) }
  }

  const send = async () => {
    if (!roomId) return Toast.warning('请先选择一个房间')
    if (!isLoggedIn && (nickname.trim().length < 2 || nickname.trim().length > 24)) return Toast.warning('请填写 2-24 个字符的游客昵称')
    if (!content.trim()) return Toast.warning('先写点内容吧')
    setSending(true)
    try {
      const outgoing = replyTo
        ? `> [引用 ${replyTo.authorName}#${replyTo.id}] ${replyTo.content.replace(/\s+/g, ' ').slice(0, 100)}\n\n${content.trim()}`
        : content.trim()
      if (outgoing.length > 1000) return Toast.warning('引用后的消息总长度不能超过 1000 个字符')
      const item = await communityApi.postMessage(roomId, { nickname: nickname.trim(), content: outgoing })
      if (!isLoggedIn) {
        const remembered = rememberGuestName(nickname)
        setNickname(remembered)
        communityApi.presence(roomId, { viewerId: selfId, name: remembered }).catch(() => {})
      }
      setMessages((items) => (items.some((existing) => existing.id === item.id) ? items : [...items, item]))
      setContent('')
      setReplyTo(null)
      nearBottomRef.current = true
      setUnread(0)
    } finally {
      setSending(false)
    }
  }

  const deleteMessage = (item) => Modal.confirm({
    title: '删除这条会话消息？',
    content: '删除后会立即从所有在线用户的会话中移除，且无法恢复。',
    okText: '删除消息',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await communityApi.deletePost('CHAT', item.id)
      setMessages((items) => items.filter((message) => message.id !== item.id))
      Toast.success('消息已删除')
    }
  })

  return (
    <div className="community-page">
      <CommunityTopbar active="community" isLoggedIn={isLoggedIn} />
      <div className="community-shell">
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
                <button type="button" className={`community-head-tool${soundOn ? ' is-on' : ''}`} onClick={toggleSound} title={soundOn ? '关闭消息声音' : '开启消息声音'}>{soundOn ? <IconVolume1 /> : <IconVolumeSilentStroked />}</button>
                <button type="button" className={`community-head-tool${notificationsOn ? ' is-on' : ''}`} onClick={enableNotifications} title="开启桌面提醒"><IconBell /></button>
                <span className={`community-status${status === 'live' ? ' is-live' : ''}`}><i />{STATUS_TEXT[status] || status}</span>
              </div>
            </div>

            <div className="community-stream community-chat-scroll" ref={chatRef} onScroll={(event) => { const node = event.currentTarget; nearBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 90; if (nearBottomRef.current) setUnread(0) }}>
              {loading
                ? <Spin />
                : (
                  <ChatStream
                    messages={messages}
                    viewer={displayName}
                    typing={typing}
                    canDelete={auth.can('community.manage')}
                    onDelete={deleteMessage}
                    onQuote={(message) => { setReplyTo(message); setContent((value) => value || '') }}
                    emptyHint={activeRoom ? undefined : { title: '还没有开放的房间', hint: '等管理员开一个房间再来。' }}
                  />
                )}
              {unread > 0 && <button type="button" className="community-unread" onClick={scrollLatest}><IconArrowDown /> {unread} 条新消息</button>}
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
              viewers={viewers.filter((viewer) => viewer.id !== selfId)}
              aiAgents={aiAgents}
              onUpload={uploadAttachment}
              uploading={uploading}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          </section>

          <aside className="community-col community-rail">
            <div className="community-panel">
              <div className="community-panel-heading">
                <IconUserGroup size="small" /> 在线 {viewers.length ? `· ${viewers.length}` : ''}
              </div>
              <ViewerList viewers={viewers} selfId={selfId} />
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}
