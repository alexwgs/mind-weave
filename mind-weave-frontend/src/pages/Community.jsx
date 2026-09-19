import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Button, Empty, Input, Spin, Tabs, Tag, TextArea, Toast } from '@douyinfe/semi-ui'
import { IconArrowLeft, IconRefresh, IconSend } from '@douyinfe/semi-icons'
import dayjs from 'dayjs'
import { communityApi } from '../api'
import { useAuth } from '../auth'
import '../community.css'

const { TabPane } = Tabs

export default function Community() {
  const auth = useAuth()
  const [tab, setTab] = useState('chat')
  const [rooms, setRooms] = useState([])
  const [roomId, setRoomId] = useState(null)
  const [messages, setMessages] = useState([])
  const [guestbook, setGuestbook] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [nickname, setNickname] = useState(() => localStorage.getItem('mindweave_guest_name') || '')
  const [content, setContent] = useState('')

  useEffect(() => {
    communityApi.rooms().then((items) => {
      setRooms(items)
      setRoomId((current) => current || items[0]?.id || null)
    }).finally(() => setLoading(false))
  }, [])

  const loadMessages = useCallback(async (quiet = false) => {
    if (!roomId) return
    if (!quiet) setLoading(true)
    try {
      const page = await communityApi.messages(roomId, { page: 1, size: 80 })
      setMessages([...(page.records || [])].reverse())
    } finally { if (!quiet) setLoading(false) }
  }, [roomId])

  const loadGuestbook = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const page = await communityApi.guestbook({ page: 1, size: 60 })
      setGuestbook(page.records || [])
    } finally { if (!quiet) setLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'chat' && roomId) loadMessages()
    if (tab === 'guestbook') loadGuestbook()
  }, [tab, roomId, loadMessages, loadGuestbook])

  useEffect(() => {
    const timer = setInterval(() => {
      if (tab === 'chat' && roomId) loadMessages(true)
      if (tab === 'guestbook') loadGuestbook(true)
    }, 6000)
    return () => clearInterval(timer)
  }, [tab, roomId, loadMessages, loadGuestbook])

  const activeRoom = useMemo(() => rooms.find((room) => room.id === roomId), [rooms, roomId])
  const isLoggedIn = !!auth.user
  const displayName = auth.user?.displayName || auth.user?.username || nickname.trim()

  const send = async () => {
    if (!isLoggedIn && (nickname.trim().length < 2 || nickname.trim().length > 24)) return Toast.warning('请填写 2-24 个字符的游客昵称')
    if (!content.trim()) return Toast.warning('先写点内容吧')
    setSending(true)
    try {
      const payload = { nickname: nickname.trim(), content: content.trim() }
      const item = tab === 'chat'
        ? await communityApi.postMessage(roomId, payload)
        : await communityApi.postGuestbook(payload)
      if (!isLoggedIn) localStorage.setItem('mindweave_guest_name', nickname.trim())
      setPending((items) => [{ ...item, localType: tab, localRoomId: roomId }, ...items])
      setContent('')
      Toast.success('已提交，审核通过后会公开显示')
    } finally { setSending(false) }
  }

  const visiblePending = pending.filter((item) => item.localType === tab && (tab !== 'chat' || item.localRoomId === roomId))

  return (
    <div className="community-page">
      <header className="community-header">
        <Link to="/blog" className="community-back"><IconArrowLeft /> 知识花园</Link>
        <div><span>PUBLIC COMMONS</span><h1>织友会客厅</h1><p>聊天是当下的相遇，留言是留给未来的一封短信。</p></div>
        <Link to={isLoggedIn ? '/home' : '/login'} className="community-account">{isLoggedIn ? '回到工作台' : '登录后发言'}</Link>
      </header>

      <main className="community-layout">
        <aside className="community-rooms">
          <strong>开放房间</strong>
          <span className="community-room-rule" />
          {rooms.map((room) => (
            <button key={room.id} className={room.id === roomId ? 'is-active' : ''} onClick={() => { setTab('chat'); setRoomId(room.id) }}>
              <i /> <span>{room.name}<small>{room.description || '一起聊聊'}</small></span>
            </button>
          ))}
          {!rooms.length && !loading && <small>暂时没有开放的房间</small>}
        </aside>

        <section className="community-board">
          <Tabs activeKey={tab} onChange={setTab} type="button">
            <TabPane tab="聊天室" itemKey="chat" />
            <TabPane tab="留言板" itemKey="guestbook" />
          </Tabs>

          <div className="community-board-title">
            <div><span>{tab === 'chat' ? 'ROOM' : 'GUESTBOOK'}</span><h2>{tab === 'chat' ? (activeRoom?.name || '聊天室') : '给这里留句话'}</h2></div>
            <Button theme="borderless" icon={<IconRefresh />} onClick={() => tab === 'chat' ? loadMessages() : loadGuestbook()}>刷新</Button>
          </div>

          <div className={`community-stream ${tab === 'guestbook' ? 'is-guestbook' : ''}`}>
            {loading ? <Spin /> : <>
              {visiblePending.map((item) => <Post key={`pending-${item.id}`} item={item} pending />)}
              {(tab === 'chat' ? messages : guestbook).map((item) => <Post key={item.id} item={item} />)}
              {!visiblePending.length && !(tab === 'chat' ? messages : guestbook).length && <Empty description={tab === 'chat' ? '审核通过的消息会出现在这里' : '还没有公开留言，来写第一封吧'} />}
            </>}
          </div>

          <div className="community-composer">
            <div className="community-identity">
              <Avatar size="small" color={isLoggedIn ? 'green' : 'amber'}>{(displayName || '游').slice(0, 1)}</Avatar>
              {isLoggedIn ? <span><strong>{displayName}</strong><small>已登录</small></span> : <Input value={nickname} onChange={setNickname} maxLength={24} placeholder="游客昵称（必填）" />}
            </div>
            <TextArea value={content} onChange={setContent} maxCount={tab === 'chat' ? 1000 : 2000} autosize={{ minRows: 2, maxRows: 5 }} placeholder={tab === 'chat' ? `在${activeRoom?.name || '房间'}说点什么…` : '写下一段想留下的话…'} />
            <div className="community-compose-foot"><span>内容提交后进入审核，通过后公开展示。</span><Button theme="solid" type="primary" loading={sending} icon={<IconSend />} onClick={send}>提交</Button></div>
          </div>
        </section>
      </main>
    </div>
  )
}

function Post({ item, pending = false }) {
  return (
    <article className={`community-post${pending ? ' is-pending' : ''}`}>
      <Avatar size="small" color={item.authorType === 'USER' ? 'green' : 'grey'}>{(item.authorName || '访').slice(0, 1)}</Avatar>
      <div><div className="community-post-meta"><strong>{item.authorName}</strong>{item.authorType === 'USER' && <Tag size="small" color="green">成员</Tag>}{pending && <Tag size="small" color="amber">待审核 · 仅你可见</Tag>}<time>{dayjs(item.createdAt).format('MM-DD HH:mm')}</time></div><p>{item.content}</p></div>
    </article>
  )
}
