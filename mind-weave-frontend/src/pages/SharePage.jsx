import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, Input, Space, Spin, Tag, Typography } from '@douyinfe/semi-ui'
import { toolApi } from '../api'
import { renderMarkdown } from '../utils/markdown'

const { Title, Text } = Typography

export default function SharePage() {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [needPassword, setNeedPassword] = useState(false)
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const access = async (pwd) => {
    setLoading(true)
    try {
      const res = await toolApi.accessShare(token, pwd)
      if (res.needPassword) {
        setNeedPassword(true)
      } else {
        setArticle(res.article)
        setNeedPassword(false)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    access()
  }, [token]) // eslint-disable-line

  if (loading) return <Spin style={{ display: 'block', margin: '120px auto' }} />
  if (error) return <div style={{ textAlign: 'center', padding: 120, color: '#f53f3f' }}>{error}</div>

  if (needPassword) {
    return (
      <Card style={{ maxWidth: 420, margin: '120px auto' }}>
        <Title heading={4}>该分享需要访问密码</Title>
        <Input mode="password" placeholder="请输入访问密码" value={password} onChange={setPassword} style={{ margin: '16px 0' }} />
        <Button type="primary" block onClick={() => access(password)}>确认</Button>
      </Card>
    )
  }

  if (!article) return null
  return (
    <div style={{ maxWidth: 860, margin: '32px auto', background: 'var(--semi-color-bg-1)', borderRadius: 8, padding: 32, boxShadow: '0 2px 12px rgba(31,35,41,.06)' }}>
      <Title heading={2}>{article.title}</Title>
      <Space style={{ margin: '12px 0' }}>
        {article.categoryPath && <Tag>{article.categoryPath}</Tag>}
        <Text type="tertiary">发布于 {String(article.createdAt).slice(0, 10)}</Text>
      </Space>
      {article.summary && <Text style={{ display: 'block', margin: '12px 0', color: 'var(--semi-color-text-1)' }}>{article.summary}</Text>}
      <div style={{ borderTop: '1px solid var(--semi-color-border)', paddingTop: 16, lineHeight: 1.8, fontSize: 15 }}>
        <div dangerouslySetInnerHTML={{ __html: article.contentHtml || renderMarkdown(article.contentMd) }} />
      </div>
    </div>
  )
}
