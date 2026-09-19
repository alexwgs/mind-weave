import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Form } from '@douyinfe/semi-ui'
import { IconLock, IconUser } from '@douyinfe/semi-icons'
import { useAuth } from '../auth'
import BrandMark from '../components/BrandMark'

export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const submit = async (values) => {
    setLoading(true)
    try {
      await auth.login(values.username, values.password)
      navigate('/home')
    } catch {
      // 错误由统一请求提示显示，保留表单以便重新尝试。
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="growth-login">
      <section className="login-story">
        <div className="login-brand"><BrandMark />MindWeave · 织脑</div>
        <div className="login-story-copy"><span>我的第二大脑</span><h1>让知识彼此连接，<br />让智能体协同<span>生长。</span></h1><p>收拢想法、计划与数据。<br />把每一次思考，编织成可以调用的网络。</p></div>
        <div className="login-note-stack" aria-hidden="true"><div><span>知识节点</span><strong>每一个想法，<br />都能找到连接。</strong><span>✳</span></div><div><span>智能体网络</span><p>✓ 理解我的上下文</p><p>✓ 协助完成下一步</p><span>连接越多，理解越深 ↗</span></div></div>
        <div className="login-story-footer">THINK · CONNECT · WEAVE</div>
      </section>
      <section className="login-form-area">
      <Card className="login-card">
        <span className="login-kicker">欢迎回到自己的空间</span>
        <h2>今天，从这里开始<span>。</span></h2>
        <p className="login-intro">登录后，继续你的记录与计划。</p>
        <Form onSubmit={submit} layout="vertical">
          <Form.Input
            field="username"
            label="用户名"
            autoComplete="username"
            prefix={<IconUser />}
            rules={[{ required: true, message: '请输入用户名' }]}
          />
          <Form.Input
            field="password"
            mode="password"
            autoComplete="current-password"
            label="密码"
            prefix={<IconLock />}
            rules={[{ required: true, message: '请输入密码' }]}
          />
          <Button htmlType="submit" theme="solid" block loading={loading} style={{ marginTop: 10 }}>
            登录我的空间
          </Button>
        </Form>
        <div style={{ marginTop: 14, textAlign: 'center', color: 'var(--semi-color-text-2)', fontSize: 12 }}>
          <a href="/blog" style={{ color: 'var(--semi-color-primary)' }}>先逛逛文章花园 →</a>
        </div>
        <div style={{ marginTop: 8, textAlign: 'center', color: 'var(--semi-color-text-2)', fontSize: 12 }}>
          使用管理员为你分配的账号登录
        </div>
      </Card>
      <span className="login-form-footer">每一点积累，都算数。</span>
      </section>
    </div>
  )
}
