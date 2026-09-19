import { Link } from 'react-router-dom'
import { Avatar, Button, Input, Tag, TextArea } from '@douyinfe/semi-ui'
import { IconArrowRight, IconComment, IconMail, IconSend } from '@douyinfe/semi-icons'
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

/** 一条公开内容，会客厅与留言板共用，差异只在皮肤与时间写法 */
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
  value, onChange, nickname, onNicknameChange, user, sending, onSend,
  maxLength, placeholder, reviewNote, actionLabel = '提交', sticky = false
}) {
  const isLoggedIn = !!user
  const displayName = user?.displayName || user?.username || (nickname || '').trim()
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
        onChange={onChange}
        maxCount={maxLength}
        autosize={{ minRows: 2, maxRows: 6 }}
        placeholder={placeholder}
        aria-label="发言内容"
      />
      <div className="community-compose-foot">
        <span>{reviewNote}</span>
        <Button theme="solid" type="primary" loading={sending} icon={<IconSend />} onClick={onSend}>{actionLabel}</Button>
      </div>
    </div>
  )
}
