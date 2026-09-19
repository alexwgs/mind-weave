import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, Empty, Spin } from '@douyinfe/semi-ui'
import { IconArrowLeft, IconArrowUp, IconComment } from '@douyinfe/semi-icons'
import { toolApi } from '../api'
import { useAuth } from '../auth'
import KnowledgeReader from '../components/KnowledgeReader'
import ArticleComments from '../components/ArticleComments'
import PublicNav from '../components/PublicNav'

export default function BlogView() {
  const auth = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const commentsRef = useRef(null)
  const [article, setArticle] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setArticle(null); setError(false)
    if (/^\d+$/.test(id || '')) toolApi.publicArticle(id).then(a => { if (active) setArticle(a) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [id])
  if (!/^\d+$/.test(id || '')) return <Navigate to="/blog" replace />
  if (error) return <Empty style={{ padding: 80 }} description="文章不存在、已取消发布或暂时无法加载"><Button onClick={() => navigate('/blog')}>返回知识库</Button></Empty>
  if (!article) return <Spin style={{ display: 'block', margin: '120px auto' }} />
  const scrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  return (
    <div className="knowledge-public">
      <PublicNav active="blog" isLoggedIn={!!auth.user} />
      <KnowledgeReader article={article} actions={<Button icon={<IconArrowLeft />} onClick={() => navigate('/blog')}>浏览知识库</Button>} />
      {article.commentEnabled === 1 && <div ref={commentsRef} id="article-comments-anchor" className="knowledge-comments-wrap"><ArticleComments article={article} /></div>}
      <nav className="knowledge-floating-actions" aria-label="文章快捷导航">
        <button type="button" aria-label="回到文章顶部" onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior })}><IconArrowUp /><span>顶部</span></button>
        {article.commentEnabled === 1 && <button type="button" aria-label="跳转到文章评论区" onClick={() => commentsRef.current?.scrollIntoView({ behavior: scrollBehavior, block: 'start' })}><IconComment /><span>评论</span></button>}
      </nav>
    </div>
  )
}
