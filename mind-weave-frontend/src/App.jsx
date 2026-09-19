import { Navigate, Route, Routes } from 'react-router-dom'
import { Component } from 'react'
import { Empty } from '@douyinfe/semi-ui'
import { useAuth } from './auth'
import AppLayout from './layouts/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Records from './pages/Records'
import Comments from './pages/Comments'
import ImportData from './pages/ImportData'
import Stats from './pages/Stats'
import Users from './pages/Users'
import Logs from './pages/Logs'
import Vault from './pages/Vault'
import Articles from './pages/Articles'
import ArticleEditor from './pages/ArticleEditor'
import ArticleView from './pages/ArticleView'
import Todos from './pages/Todos'
import Settings from './pages/Settings'
import SharePage from './pages/SharePage'
import Blog from './pages/Blog'
import BlogView from './pages/BlogView'
import Home from './pages/Home'
import LifeRpg from './pages/LifeRpg'
import ApiManager from './pages/ApiManager'
import Community from './pages/Community'
import CommunityAdmin from './pages/CommunityAdmin'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'monospace', fontSize: 14 }}>
          <div style={{ color: '#f53f3f', marginBottom: 12 }}>页面渲染出错：</div>
          <pre style={{ background: 'var(--semi-color-bg-0)', padding: 16, borderRadius: 8, overflow: 'auto', textAlign: 'left' }}>
            {String(this.state.error && this.state.error.message)}
          </pre>
          <button onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{ marginTop: 16, padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--semi-color-primary)', color: '#fff', cursor: 'pointer' }}>
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function Protected() {
  const auth = useAuth()
  return auth.user ? <AppLayout /> : <Navigate to="/login" replace />
}

function AdminOnly({ children }) {
  const auth = useAuth()
  return auth.can('users.manage') ? children : <Navigate to="/home" replace />
}

function EditOnly({ children }) {
  const auth = useAuth()
  return auth.can('import.execute') ? children : <Navigate to="/home" replace />
}

// 页面级权限守卫：无权限时显示空态，不再渲染任何数据
function PermOnly({ code, children }) {
  const auth = useAuth()
  return auth.can(code) ? children : (
    <Empty description="无权限访问该页面" style={{ padding: '100px 0' }} />
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected />}>
          <Route path="/dashboard" element={<PermOnly code="dashboard"><Dashboard /></PermOnly>} />
          <Route path="/home" element={<PermOnly code="home"><Home /></PermOnly>} />
          <Route path="/rpg" element={<PermOnly code="home"><LifeRpg /></PermOnly>} />
          <Route path="/records" element={<PermOnly code="records"><Records /></PermOnly>} />
          <Route path="/comments" element={<PermOnly code="comments"><Comments /></PermOnly>} />
          <Route path="/import" element={<PermOnly code="import"><EditOnly><ImportData /></EditOnly></PermOnly>} />
          <Route path="/stats" element={<PermOnly code="stats"><Stats /></PermOnly>} />
          <Route path="/users" element={<PermOnly code="users"><AdminOnly><Users /></AdminOnly></PermOnly>} />
          <Route path="/logs" element={<PermOnly code="logs"><AdminOnly><Logs /></AdminOnly></PermOnly>} />
          <Route path="/vault" element={<PermOnly code="vault"><Vault /></PermOnly>} />
          <Route path="/articles" element={<PermOnly code="articles"><Articles /></PermOnly>} />
          <Route path="/portal" element={<PermOnly code="articles"><Blog /></PermOnly>} />
          <Route path="/article/new" element={<PermOnly code="articles"><ArticleEditor /></PermOnly>} />
          <Route path="/article/:id" element={<PermOnly code="articles"><ArticleEditor /></PermOnly>} />
          <Route path="/article-view/:id" element={<PermOnly code="articles"><ArticleView /></PermOnly>} />
          <Route path="/todos" element={<PermOnly code="todos"><Todos /></PermOnly>} />
          <Route path="/settings" element={<PermOnly code="settings"><Settings /></PermOnly>} />
          <Route path="/apis" element={<PermOnly code="apis"><ApiManager /></PermOnly>} />
          <Route path="/community-admin" element={<PermOnly code="community"><CommunityAdmin /></PermOnly>} />
        </Route>
        <Route path="/share/:token" element={<SharePage />} />
        {/* 站点默认入口是公开知识花园，管理后台仍在 /login 与 /home */}
        <Route path="/" element={<Navigate to="/blog" replace />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:id" element={<BlogView />} />
        <Route path="/community" element={<Community />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
