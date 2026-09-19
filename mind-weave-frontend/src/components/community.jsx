import { Link } from 'react-router-dom'
import { Avatar, Button, Input, Tag, TextArea } from '@douyinfe/semi-ui'
import { IconArrowRight, IconComment, IconMail, IconSend, IconUserGroup } from '@douyinfe/semi-icons'
import dayjs from 'dayjs'

/** 相对时间：会客厅是当下的对话，用"几分钟前"比时间戳更贴合语境 */
export function relativeTime(value) {
  if (!value) return ''
  const then = dayjs(value)
  if (!then.isValid()) return ''
  const minutes = dayjs().diff(then, 'minute')
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = dayjs().diff(then, 'hour')
  if (hours < 24) return `${hours} 小时前`
  const days = dayjs().diff(then, 'day')
  if (days < 7) return `${days} 天前`
  return then.format('YYYY-MM-DD')
}

/** 气泡内的时间：今天的会话只显示时分，更早的补上日期 */
export function bubbleTime(value) {
  if (!value) return ''
  const then = dayjs(value)
  if (!then.isValid()) return ''
  return then.isSame(dayjs(), 'day') ? then.format('HH:mm') : then.format('MM-DD HH:mm')
}

function dayLabel(value) {
  const then = dayjs(value)
  if (!then.isValid()) return ''
  if (then.isSame(dayjs(), 'day')) return '今天'
  if (then.isSame(dayjs().subtract(1, 'day'), 'day')) return '昨天'
  return then.format('YYYY 年 M 月 D 日')
}

/** 头像底色：按昵称散列取一个稳定的浅色，不依赖后端字段 */
const AVATAR_TONES = ['avatar-tone-a', 'avatar-tone-b', 'avatar-tone-c', 'avatar-tone-d']
function avatarTone(name) {
  const text = name || ''
  let sum = 0
  for (let i = 0; i < text.length; i += 1) sum = (sum + text.charCodeAt(i)) % 997
  return AVATAR_TONES[sum % AVATAR_TONES.length]
}

const GROUP_GAP_MINUTES = 5

/**
 * 把线性消息整理成 IM 对话流：
 * 连续的同一作者（5 分钟内）合并成一组，只显示一次头像与昵称；
 * 跨天插入日期分割线。
 */
export function groupMessages(messages, viewer) {
  const blocks = []
  let last = null
  for (const message of messages || []) {
    const isOwn = !!viewer && message.authorName === viewer
    const moment = dayjs(message.createdAt)
    const startsNewDay = !last || !moment.isSame(dayjs(last.createdAt), 'day')
    if (startsNewDay) blocks.push({ kind: 'day', key: `day-${message.id}`, label: dayLabel(message.createdAt) })

    const sameAuthor = last
      && !startsNewDay
      && last.authorName === message.authorName
      && last.isOwn === isOwn
      && moment.diff(dayjs(last.createdAt), 'minute') < GROUP_GAP_MINUTES

    if (sameAuthor) {
      last.items.push(message)
      last.createdAt = message.createdAt
    } else {
      const group = {
        kind: 'group',
        key: `group-${message.id}`,
        authorName: message.authorName,
        authorType: message.authorType,
        isOwn,
        createdAt: message.createdAt,
        items: [message]
      }
      blocks.push(group)
      last = group
    }
  }
  return blocks
}

export function BrandGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="13" r="2.6" fill="#4fd39a" />
      <circle cx="13" cy="13" r="6.2" stroke="#4fd39a" strokeOpacity=".45" strokeWidth="1" />
      <circle cx="21" cy="7" r="1.9" fill="#d9a06a" />
      <circle cx="5" cy="18.5" r="1.7" fill="#8fb3a1" />
      <circle cx="20" cy="19.5" r="1.4" fill="#8fb3a1" />
      <path d="M13 13 21 7M13 13 5 18.5M13 13 20 19.5" stroke="#8fb3a1" strokeOpacity=".55" strokeWidth=".9" />
    </svg>
  )
}

/** 公开站点的顶部导航，会客厅与留言板互相可达 */
export function CommunityTopbar({ active, isLoggedIn }) {
  return (
    <header className="community-topbar">
      <Link to="/blog" className="community-brand" aria-label="回到知识花园">
        <BrandGlyph />
        <span>
          <span className="community-brand-name">织友会客厅</span>
          <span className="community-brand-sub">PUBLIC COMMONS</span>
        </span>
      </Link>
      <nav className="community-nav">
        <Link to="/blog">知识花园</Link>
        <Link to="/community" className={active === 'community' ? 'is-active' : ''}>
          <IconComment size="small" /> 会客厅
        </Link>
        <Link to="/guestbook" className={active === 'guestbook' ? 'is-active' : ''}>
          <IconMail size="small" /> 留言板
        </Link>
        <Link to={isLoggedIn ? '/home' : '/login'} className="community-admin-link">
          {isLoggedIn ? '回到工作台' : '登录'}
          <IconArrowRight size="small" />
        </Link>
      </nav>
    </header>
  )
}

/** 在线成员列表（数据来自 SSE 帧，不需要单独轮询） */
export function ViewerList({ viewers, selfId }) {
  if (!viewers.length) {
    return <p className="community-rail-empty">房间里暂时只有你。其他人进入后会出现在这里。</p>
  }
  return (
    <ul className="community-viewers">
      {viewers.map((viewer) => (
        <li key={viewer.id} className={viewer.id === selfId ? 'is-self' : ''}>
          <Avatar size="extra-small" className={avatarTone(viewer.name)}>{(viewer.name || '访').slice(0, 1)}</Avatar>
          <span className="community-viewer-name">
            {viewer.name}
            {viewer.id === selfId && <small>（我）</small>}
          </span>
          <i aria-hidden="true" />
          {!viewer.guest && <Tag size="small" color="green">成员</Tag>}
        </li>
      ))}
    </ul>
  )
}

/** IM 风格的对话流：自己的消息右对齐，连续发言合并气泡 */
export function ChatStream({ messages, viewer, typing, emptyHint }) {
  const blocks = groupMessages(messages, viewer)
  return (
    <div className="community-chat">
      {!blocks.length && <div className="community-empty"><h3>{emptyHint?.title || '这个房间还很安静'}</h3><p>{emptyHint?.hint || '说第一句话，把这里点亮。'}</p></div>}
      {blocks.map((block) => block.kind === 'day'
        ? <div className="community-day" key={block.key}><span>{block.label}</span></div>
        : (
          <div className={`community-msg${block.isOwn ? ' is-own' : ''}`} key={block.key}>
            {!block.isOwn && (
              <Avatar size="small" className={avatarTone(block.authorName)}>{(block.authorName || '访').slice(0, 1)}</Avatar>
            )}
            <div className="community-msg-body">
              <div className="community-msg-head">
                <strong>{block.authorName}</strong>
                {block.authorType === 'USER' && <Tag size="small" color="green">成员</Tag>}
                <time>{bubbleTime(block.createdAt)}</time>
              </div>
              {block.items.map((item) => <p className="community-bubble" key={item.id}>{item.content}</p>)}
            </div>
          </div>
        ))}
      {typing.length > 0 && (
        <div className="community-typing" aria-live="polite">
          <span className="community-typing-dots" aria-hidden="true"><i /><i /><i /></span>
          {typing.length === 1 ? `${typing[0]} 正在输入…` : `${typing.slice(0, 2).join('、')} 正在输入…`}
        </div>
      )}
    </div>
  )
}

/** 一条公开内容，留言板与文章评论共用 */
export function Post({ item, variant = 'chat', mine = false, pending = false }) {
  const isGuestbook = variant === 'guestbook'
  return (
    <article className={`community-post${mine ? ' is-mine' : ''}${pending ? ' is-pending' : ''}`}>
      <Avatar size="small" color={item.authorType === 'USER' ? 'green' : 'grey'}>
        {(item.authorName || '访').slice(0, 1)}
      </Avatar>
      <div>
        <div className="community-post-meta">
          <strong>{item.authorName}</strong>
          {item.authorType === 'USER' && <Tag size="small" color="green">成员</Tag>}
          {mine && !pending && <Tag size="small" color="violet">我</Tag>}
          {pending && <Tag size="small" color="amber">待审核</Tag>}
          <time>{isGuestbook ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : relativeTime(item.createdAt)}</time>
        </div>
        <p>{item.content}</p>
      </div>
    </article>
  )
}

/** 发言区：会客厅即时公开，留言板先审后发 */
export function Composer({
  value, onChange, nickname, onNicknameChange, user, sending, onSend, onTyping,
  maxLength, placeholder, reviewNote, actionLabel = '提交', sticky = false, disabled = false
}) {
  const isLoggedIn = !!user
  const displayName = user?.displayName || user?.username || (nickname || '').trim()
  const submitOnEnter = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    onSend()
  }
  return (
    <div className={`community-composer${sticky ? ' is-sticky' : ''}`}>
      <div className="community-identity">
        <Avatar size="small" color={isLoggedIn ? 'green' : 'amber'}>{(displayName || '游').slice(0, 1)}</Avatar>
        {isLoggedIn
          ? <span><strong>{displayName}</strong><small>已登录 · 以成员身份发言</small></span>
          : <Input value={nickname} onChange={onNicknameChange} maxLength={24} placeholder="游客昵称（2-24 个字符）" aria-label="游客昵称" />}
      </div>
      <TextArea
        value={value}
        onChange={(next) => { onChange(next); onTyping?.() }}
        onKeyDown={submitOnEnter}
        maxCount={maxLength}
        autosize={{ minRows: 2, maxRows: 6 }}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="发言内容"
      />
      <div className="community-compose-foot">
        <span>{reviewNote}</span>
        <Button theme="solid" type="primary" loading={sending} disabled={disabled} icon={<IconSend />} onClick={onSend}>{actionLabel}</Button>
      </div>
    </div>
  )
}
