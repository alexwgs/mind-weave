import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, Empty, Spin } from '@douyinfe/semi-ui'
import { IconArrowLeft, IconEdit } from '@douyinfe/semi-icons'
import { toolApi } from '../api'
import { useAuth } from '../auth'
import KnowledgeReader from '../components/KnowledgeReader'

export default function ArticleView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const [article, setArticle] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setArticle(null); setError(false)
    if (/^\d+$/.test(id || '')) toolApi.article(id).then(a => { if (active) setArticle(a) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [id])
  if (!/^\d+$/.test(id || '')) return <Navigate to="/articles" replace />
  if (error) return <Empty description="文章加载失败，请返回知识库后重试"><Button onClick={() => navigate('/articles')}>返回知识库</Button></Empty>
  if (!article) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  return <KnowledgeReader article={article} actions={<>
    <Button icon={<IconArrowLeft />} theme="borderless" onClick={() => navigate('/articles')}>知识库</Button>
    {auth.can('article.edit') && <Button icon={<IconEdit />} onClick={() => navigate(`/article/${article.id}`)}>编辑文章</Button>}
  </>} />
}
