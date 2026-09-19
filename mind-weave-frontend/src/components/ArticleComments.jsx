import { useEffect, useState } from 'react'
import { Avatar, Button, Empty, Input, Tag, TextArea, Toast } from '@douyinfe/semi-ui'
import dayjs from 'dayjs'
import { communityApi } from '../api'
import { useAuth } from '../auth'
import '../community.css'

export default function ArticleComments({ article }) {
  const auth = useAuth()
  const [items, setItems] = useState([])
  const [pending, setPending] = useState([])
  const [nickname, setNickname] = useState(() => localStorage.getItem('mindweave_guest_name') || '')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (article.commentEnabled !== 1) return
    communityApi.articleComments(article.id, { page: 1, size: 60 }).then((page) => setItems(page.records || []))
  }, [article.id, article.commentEnabled])

  if (article.commentEnabled !== 1) return null

  const displayName = auth.user?.displayName || auth.user?.username || nickname.trim()
  const send = async () => {
    if (!auth.user && (nickname.trim().length < 2 || nickname.trim().length > 24)) return Toast.warning('请填写 2-24 个字符的游客昵称')
    if (!content.trim()) return Toast.warning('先写下评论内容')
    setSending(true)
    try {
      const item = await communityApi.postArticleComment(article.id, { nickname: nickname.trim(), content: content.trim() })
      if (!auth.user) localStorage.setItem('mindweave_guest_name', nickname.trim())
      setPending((before) => [item, ...before])
      setContent('')
      Toast.success('评论已提交，审核通过后会公开显示')
    } finally { setSending(false) }
  }

  return (
    <section className="article-comments" aria-labelledby="article-comments-title">
      <h2 id="article-comments-title">文章评论</h2>
      <p className="article-comments-sub">留下你的想法。评论会在审核通过后公开。</p>
      <div className="community-stream is-guestbook">
        {pending.map((item) => <Comment key={`pending-${item.id}`} item={item} pending />)}
        {items.map((item) => <Comment key={item.id} item={item} />)}
        {!pending.length && !items.length && <Empty description="还没有公开评论" />}
      </div>
      <div className="community-composer">
        <div className="community-identity">
          <Avatar size="small" color={auth.user ? 'green' : 'amber'}>{(displayName || '游').slice(0, 1)}</Avatar>
          {auth.user ? <span><strong>{displayName}</strong><small>已登录</small></span> : <Input value={nickname} onChange={setNickname} maxLength={24} placeholder="游客昵称（必填）" />}
        </div>
        <TextArea value={content} onChange={setContent} maxCount={1200} autosize={{ minRows: 2, maxRows: 5 }} placeholder="写下与这篇文章有关的想法…" />
        <div className="community-compose-foot"><span>先提交、审核后显示</span><Button theme="solid" type="primary" loading={sending} onClick={send}>提交评论</Button></div>
      </div>
    </section>
  )
}

function Comment({ item, pending = false }) {
  return <article className={`community-post${pending ? ' is-pending' : ''}`}><Avatar size="small" color={item.authorType === 'USER' ? 'green' : 'grey'}>{(item.authorName || '访').slice(0, 1)}</Avatar><div><div className="community-post-meta"><strong>{item.authorName}</strong>{item.authorType === 'USER' && <Tag size="small" color="green">成员</Tag>}{pending && <Tag size="small" color="amber">待审核 · 仅你可见</Tag>}<time>{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}</time></div><p>{item.content}</p></div></article>
}
