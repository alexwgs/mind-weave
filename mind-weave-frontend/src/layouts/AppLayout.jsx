import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button, Dropdown, Input, Modal, SideSheet, Toast } from '@douyinfe/semi-ui'
import { IconArticle, IconChevronDown, IconComment, IconCrown, IconExit, IconHistogram, IconHome, IconKey, IconLock, IconMenu, IconPieChartStroked, IconUpload, IconUserGroup, IconSetting, IconClock, IconBookStroked, IconEyeOpened, IconMoon, IconSun, IconSearch, IconServer } from '@douyinfe/semi-icons'
import { useAuth } from '../auth'
import { authApi, toolApi } from '../api'
import { useTheme } from '../theme'
import AIChat from '../components/AIChat'
import BrandMark from '../components/BrandMark'

const SECTIONS = [
  { title: '我的空间', items: [['home', '成长工作台', IconHome], ['rpg', '人生 RPG', IconCrown], ['articles', '知识库', IconBookStroked], ['todos', '日程待办', IconClock], ['vault', '我的保险箱', IconLock]] },
  { title: '收支管理', items: [['dashboard', '收支概览', IconPieChartStroked], ['records', '工资记录', IconHistogram], ['comments', '字段批注', IconComment], ['import', '数据导入', IconUpload], ['stats', '统计分析', IconArticle]] },
  { title: '管理与设置', items: [['community-admin', '互动管理', IconComment], ['users', '用户管理', IconUserGroup], ['logs', '操作日志', IconArticle], ['apis', 'API 管理', IconServer], ['settings', '系统设置', IconSetting]] }
]
const META = {
  home: ['成长工作台', '把生活的小事，慢慢整理成喜欢的样子。'], dashboard: ['收支概览', '看见每一份努力，留下的积累。'],
  rpg: ['人生 RPG', '把真实行动编织成看得见的成长。'],
  records: ['工资记录', '清晰记录每个月的收入与支出。'], comments: ['字段批注', '为数字补充来龙去脉。'], import: ['数据导入', '将工资表整理进你的收支档案。'],
  stats: ['统计分析', '从趋势中了解自己的积累。'], users: ['用户管理', '管理账号、权限与数据范围。'], logs: ['操作日志', '查看系统里的每一次重要操作。'],
  vault: ['我的保险箱', '给账号、密码与重要凭证一个固定的位置。'], articles: ['知识库', '让灵感落地，让知识长出新的枝叶。'],
  portal: ['文章花园', '翻一翻最近留下的文字。'], todos: ['日程待办', '安排好下一步，给生活留一点从容。'], settings: ['系统设置', '把这个空间调整成你习惯的样子。'],
  apis: ['API 管理', '统一查看、调试与控制系统里的每一个接口。'],
  'community-admin': ['互动管理', '审核公开发言、留言与文章评论，管理聊天室房间。'],
  article: ['写作空间', '记录当下的想法。'], 'article-view': ['阅读空间', '给自己一点专注阅读的时间。']
}
const ROLES = { ADMIN: '管理员', MANAGER: '数据维护', USER: '普通用户', VIEWER: '只读用户' }

export default function AppLayout() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, toggle } = useTheme()
  const [drawer, setDrawer] = useState(false)
  const [pwdVisible, setPwdVisible] = useState(false)
  const [passwords, setPasswords] = useState({ old: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [siteName, setSiteName] = useState('MindWeave · 织脑')
  const [search, setSearch] = useState('')
  const current = location.pathname.split('/')[1] || 'home'
  const [title, subtitle] = META[current] || ['我的空间', '']
  const person = auth.user?.displayName || auth.user?.username || ''
  useEffect(() => { toolApi.settings().then(s => { if (s?.siteName) setSiteName(s.siteName) }).catch(() => {}) }, [])
  useEffect(() => { document.title = `${title} · ${siteName}`; setDrawer(false) }, [location.pathname, siteName, title])
  const changePassword = async () => {
    if (!passwords.old || !passwords.next) return Toast.warning('请填写原密码和新密码')
    if (passwords.next !== passwords.confirm) return Toast.warning('两次输入的新密码不一致')
    setSaving(true)
    try {
      await authApi.changePassword({ oldPassword: passwords.old, newPassword: passwords.next })
      Toast.success('密码修改成功'); setPwdVisible(false); setPasswords({ old: '', next: '', confirm: '' })
    } catch { /* 保留输入以便重试 */ } finally { setSaving(false) }
  }
  const navigation = <div className="sidebar-inner">
    <NavLink to="/home" className="workspace-brand"><BrandMark /><span>{siteName}<small>第二大脑 · 智能体网络</small></span></NavLink>
    <nav aria-label="主导航" className="workspace-nav">{SECTIONS.map(section => {
      const items = section.items.filter(([key]) => auth.can(key === 'rpg' ? 'home' : key === 'community-admin' ? 'community' : key))
      return items.length > 0 && <div className="nav-section" key={section.title}><div className="nav-section-label">{section.title}</div>
        {items.map(([key, name, Icon]) => <NavLink key={key} to={`/${key}`} className={({ isActive }) => `workspace-nav-link${isActive || (key === 'articles' && ['article', 'article-view', 'portal'].includes(current)) ? ' is-active' : ''}`}><Icon /><span>{name}</span><span className="nav-active-dot" /></NavLink>)}
      </div>
    })}</nav>
    {auth.can('articles') && <a href="/blog" target="_blank" rel="noreferrer" className="sidebar-garden"><IconEyeOpened /><span>逛逛文章花园<small>在新窗口浏览公开文章</small></span><span>↗</span></a>}
    <div className="sidebar-foot"><span className="status-dot" /> 每一点积累，都算数。</div>
  </div>
  return <div className="workspace-shell">
    <a href="#workspace-main" className="skip-link">跳到主要内容</a>
    <aside className="workspace-sidebar">{navigation}</aside>
    <div className="workspace-body">
      <header className="workspace-topbar">
        <Button className="mobile-menu" theme="borderless" icon={<IconMenu />} aria-label="打开导航" onClick={() => setDrawer(true)} />
        <div className="workspace-breadcrumb"><span>我的空间</span><span>/</span><strong>{title}</strong></div>
        {auth.can('articles') && <form className="workspace-search" onSubmit={event => { event.preventDefault(); navigate(`/articles?keyword=${encodeURIComponent(search.trim())}`) }}><IconSearch /><input aria-label="搜索知识库" placeholder="寻找一篇文章…" value={search} onChange={e => setSearch(e.target.value)} /><button type="submit" aria-label="搜索">↵</button></form>}
        <Button theme="borderless" icon={mode === 'dark' ? <IconSun /> : <IconMoon />} onClick={toggle} aria-label={mode === 'dark' ? '切换浅色模式' : '切换深色模式'} />
        <Dropdown trigger="click" position="bottomRight" render={<Dropdown.Menu><Dropdown.Item icon={<IconKey />} onClick={() => setPwdVisible(true)}>修改密码</Dropdown.Item><Dropdown.Item icon={<IconExit />} onClick={() => { auth.logout(); navigate('/login') }}>退出登录</Dropdown.Item></Dropdown.Menu>}>
          <button className="profile-button" aria-label="账户菜单"><span className="profile-avatar">{person.slice(0, 1).toUpperCase()}</span><span className="profile-name">{person}<small>{ROLES[auth.role] || auth.role}</small></span><IconChevronDown /></button>
        </Dropdown>
      </header>
      <main id="workspace-main" tabIndex={-1} className={`workspace-main route-${current}`}>
        {!['home', 'rpg', 'articles', 'article', 'article-view', 'todos', 'portal'].includes(current) && <div className="workspace-page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div><span className="heading-leaf" aria-hidden="true">✳</span></div>}
        <Outlet /><footer className="workspace-footer"><span>{siteName}</span><span>编织我的第二大脑与 AI 智能体网络</span></footer>
      </main>
    </div>
    <SideSheet visible={drawer} onCancel={() => setDrawer(false)} width={264} placement="left" title="导航" bodyStyle={{ padding: 0 }}><div className="mobile-sidebar">{navigation}</div></SideSheet>
    <Modal title="修改密码" visible={pwdVisible} onOk={changePassword} confirmLoading={saving} onCancel={() => setPwdVisible(false)} okText="保存新密码" cancelText="取消" width={420}><div className="password-fields">{[['old', '原密码'], ['next', '新密码'], ['confirm', '确认新密码']].map(([key, label]) => <label key={key}>{label}<Input mode="password" value={passwords[key]} onChange={v => setPasswords(p => ({ ...p, [key]: v }))} autoComplete={key === 'old' ? 'current-password' : 'new-password'} /></label>)}</div></Modal>
    <AIChat />
  </div>
}
