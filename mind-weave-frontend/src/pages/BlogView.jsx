import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, Empty, Spin } from '@douyinfe/semi-ui'
import { IconArrowLeft } from '@douyinfe/semi-icons'
import { toolApi } from '../api'
import KnowledgeReader from '../components/KnowledgeReader'
import ArticleComments from '../components/ArticleComments'

export default function BlogView() {
  const { id } = useParams()
  const navigate = useNavigate()
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
  return <div className="knowledge-public"><KnowledgeReader article={article} actions={<Button icon={<IconArrowLeft />} onClick={() => navigate('/blog')}>浏览知识库</Button>} /><ArticleComments article={article} /></div>
}
