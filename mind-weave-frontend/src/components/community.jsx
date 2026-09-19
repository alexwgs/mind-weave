import { useRef, useState } from 'react'
import { Avatar, Button, Image, Input, Modal, Tag, TextArea, Tooltip } from '@douyinfe/semi-ui'
import { IconAt, IconClose, IconDelete, IconExpand, IconExternalOpen, IconImage, IconMinus, IconPlus, IconReply, IconSend, IconUpload, IconVideo } from '@douyinfe/semi-icons'
import dayjs from 'dayjs'
import PublicNav from './PublicNav'

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

/** 公开站点的顶部导航，会客厅与留言板互相可达 */
export function CommunityTopbar({ active, isLoggedIn }) {
  return <PublicNav active={active} isLoggedIn={isLoggedIn} />
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

/** 聊天内容只解析受控的 @提及和本站附件标记，普通文字始终由 React 转义。 */
export function ChatContent({ content }) {
  const [preview, setPreview] = useState(null)
  const [zoom, setZoom] = useState(1)
  const quote = String(content || '').match(/^> \[引用 ([^\]#]+)#(\d+)\] ([^\n]*)\n\n?([\s\S]*)$/)
  if (quote) return <><div className="community-quote"><strong>回复 {quote[1]}</strong><span>{quote[3]}</span></div><ChatContent content={quote[4]} /></>
  const pattern = /(@video\[[^\]]*\]\(attachment:\d+(?:\s+"size=\d+")?\)|!?\[[^\]]*\]\(attachment:\d+(?:\s+"size=\d+")?\)|@[\w\u3400-\u9fff-]{1,24})/g
  const nodes = String(content || '').split(pattern).filter(Boolean).map((part, index) => {
    const video = part.match(/^@video\[([^\]]*)\]\(attachment:(\d+)(?:\s+"size=(\d+)")?\)$/)
    if (video) {
      const [, label, id, size] = video
      const src = `/api/tool/attachments/${id}/content`
      return <MediaCard key={`${id}-${index}`} type="video" src={src} label={label || '聊天视频'} size={size} onPreview={() => { setZoom(1); setPreview({ type: 'video', src, label: label || '聊天视频' }) }} />
    }
    const attachment = part.match(/^(!?)\[([^\]]*)\]\(attachment:(\d+)(?:\s+"size=(\d+)")?\)$/)
    if (attachment) {
      const [, image, label, id, size] = attachment
      if (image) {
        const src = `/api/tool/attachments/${id}/content`
        return <MediaCard key={`${id}-${index}`} type="image" src={src} label={label || '聊天图片'} />
      }
      const meta = size ? `${(Number(size) / 1024 / 1024).toFixed(1)} MB` : '下载文件'
      return <a className="community-file" href={`/api/tool/attachments/${id}/download`} download key={`${id}-${index}`}><span>↗</span><b>{label || '附件'}</b><small>{meta}</small></a>
    }
    if (part.startsWith('@')) return <mark className="community-mention" key={`${part}-${index}`}>{part}</mark>
    return part
  })
  return <>{nodes}<Modal className="community-media-modal" visible={!!preview} footer={null} centered closeOnEsc maskClosable onCancel={() => setPreview(null)} title={preview?.label}>{preview && <div className="community-media-preview"><div className="community-media-viewport"><video src={preview.src} controls autoPlay playsInline style={{ transform: `scale(${zoom})` }} /></div><div className="community-media-preview-tools"><div><Button size="small" theme="borderless" icon={<IconMinus />} disabled={zoom <= .5} onClick={() => setZoom((value) => Math.max(.5, +(value - .25).toFixed(2)))} aria-label="缩小" /><span>{Math.round(zoom * 100)}%</span><Button size="small" theme="borderless" icon={<IconPlus />} disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, +(value + .25).toFixed(2)))} aria-label="放大" /><Button size="small" theme="borderless" onClick={() => setZoom(1)}>适应窗口</Button></div><a href={preview.src} target="_blank" rel="noreferrer"><IconExternalOpen /> 在新页面打开</a></div></div>}</Modal></>
}

function MediaCard({ type, src, label, size, onPreview }) {
  const meta = size ? `${(Number(size) / 1024 / 1024).toFixed(1)} MB` : ''
  const imagePreview = { previewTitle: label, zoomStep: .25, minZoom: .1, maxZoom: 5, maskClosable: true, closeOnEsc: true, zoomInTip: '放大', zoomOutTip: '缩小', rotateTip: '旋转', adaptiveTip: '适应窗口', originTip: '原始尺寸', downloadTip: '下载' }
  return <figure className={`community-media is-${type}`}><div className="community-media-frame">{type === 'image' ? <Image src={src} alt={label} width="100%" preview={imagePreview} imgStyle={{ maxHeight: 360, objectFit: 'contain' }} /> : <video src={src} controls preload="metadata" playsInline />}{type === 'video' && <button type="button" className="community-media-expand" onClick={onPreview} aria-label={`放大预览 ${label}`}><IconExpand /></button>}</div><figcaption><span><b>{label}</b>{meta && <small>{meta}</small>}</span><a href={src} target="_blank" rel="noreferrer" aria-label={`在新页面打开 ${label}`}><IconExternalOpen /> 新页面</a></figcaption></figure>
}

/** IM 风格的对话流：自己的消息右对齐，连续发言合并气泡 */
export function ChatStream({ messages, viewer, typing, emptyHint, onQuote, canDelete = false, onDelete }) {
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
                {block.authorType === 'AI' && <Tag size="small" color="violet">AI</Tag>}
                <time>{bubbleTime(block.createdAt)}</time>
              </div>
              {block.items.map((item) => <div className="community-bubble-wrap" key={item.id}><div className="community-bubble"><ChatContent content={item.content} /></div><div className="community-message-actions"><button type="button" className="community-reply" onClick={() => onQuote?.(item)} aria-label={`引用 ${block.authorName} 的消息`}><IconReply /></button>{canDelete && <button type="button" className="community-reply is-delete" onClick={() => onDelete?.(item)} aria-label={`删除 ${block.authorName} 的消息`}><IconDelete /></button>}</div></div>)}
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
  maxLength, placeholder, reviewNote, actionLabel = '提交', sticky = false, disabled = false,
  viewers = [], aiAgents = [], onUpload, uploading = false, replyTo, onCancelReply
}) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const fileRef = useRef(null)
  const isLoggedIn = !!user
  const displayName = user?.displayName || user?.username || (nickname || '').trim()
  const mentionOptions = isLoggedIn ? [...aiAgents.map((agent) => ({ ...agent, ai: true })), ...viewers] : viewers
  const emojis = ['😀', '😄', '😂', '🤣', '😊', '🥰', '😍', '😘', '😎', '🤓', '🤔', '🫡', '🤩', '🥳', '😴', '😭', '😤', '😡', '😱', '🤯', '🥺', '😅', '🙃', '😉', '👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '👌', '✌️', '🤞', '👀', '❤️', '💜', '💚', '💯', '🔥', '✨', '🎉', '🎈', '✅', '❌', '💡', '🚀', '☕', '🍵', '🍄', '🌱', '🌿', '🌸', '🌙', '☀️', '📚']
  const insert = (text) => {
    onChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}${text}`)
    onTyping?.()
  }
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
      {replyTo && <div className="community-compose-quote"><span><strong>回复 {replyTo.authorName}</strong>{replyTo.content.replace(/^> \[引用[^\n]*\]\s*/, '').slice(0, 100)}</span><button type="button" onClick={onCancelReply} aria-label="取消引用"><IconClose /></button></div>}
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
      <div className="community-compose-tools">
        <div className="community-tool-wrap">
          <Tooltip content="表情"><button type="button" className="community-tool" onClick={() => { setEmojiOpen(!emojiOpen); setMentionOpen(false) }} aria-label="选择表情">☺</button></Tooltip>
          {emojiOpen && <div className="community-picker emoji-picker">{emojis.map((emoji) => <button type="button" key={emoji} onClick={() => { insert(emoji); setEmojiOpen(false) }}>{emoji}</button>)}</div>}
        </div>
        <div className="community-tool-wrap">
          <Tooltip content="@ 在线成员"><button type="button" className="community-tool" onClick={() => { setMentionOpen(!mentionOpen); setEmojiOpen(false) }} aria-label="提及成员"><IconAt /></button></Tooltip>
          {mentionOpen && <div className="community-picker mention-picker"><span>提及在线成员</span>{mentionOptions.length ? mentionOptions.map((viewer) => <button type="button" className={viewer.ai ? 'is-ai' : ''} key={viewer.id} onClick={() => { insert(`@${viewer.name} `); setMentionOpen(false) }}><Avatar size="extra-small" color={viewer.ai ? 'violet' : undefined} className={viewer.ai ? undefined : avatarTone(viewer.name)}>{viewer.ai ? '梦' : viewer.name.slice(0, 1)}</Avatar><b>{viewer.name}</b>{viewer.ai && <small>AI</small>}</button>) : <small>暂时没有在线成员</small>}</div>}
        </div>
        <Tooltip content="发送图片"><button type="button" className="community-tool" disabled={disabled || uploading} onClick={() => { fileRef.current.accept = 'image/*'; fileRef.current.click() }} aria-label="发送图片"><IconImage /></button></Tooltip>
        <Tooltip content="发送视频（最大 80MB）"><button type="button" className="community-tool" disabled={disabled || uploading} onClick={() => { fileRef.current.accept = 'video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg'; fileRef.current.click() }} aria-label="发送视频"><IconVideo /></button></Tooltip>
        <Tooltip content="发送文件"><button type="button" className="community-tool" disabled={disabled || uploading} onClick={() => { fileRef.current.accept = '.pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z'; fileRef.current.click() }} aria-label="发送文件"><IconUpload /></button></Tooltip>
        <input ref={fileRef} type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload?.(file); event.target.value = '' }} />
        {uploading && <span className="community-uploading">附件上传中…</span>}
      </div>
      <div className="community-compose-foot">
        <span>{reviewNote}</span>
        <Button theme="solid" type="primary" loading={sending} disabled={disabled} icon={<IconSend />} onClick={onSend}>{actionLabel}</Button>
      </div>
    </div>
  )
}
