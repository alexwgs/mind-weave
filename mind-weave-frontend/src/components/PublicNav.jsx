import { Link } from 'react-router-dom'
import { Button } from '@douyinfe/semi-ui'
import { IconComment, IconMail, IconMoon, IconSun } from '@douyinfe/semi-icons'
import { useTheme } from '../theme'
import './public-nav.css'

function WeaveMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 22 16 9l9 13M7 22h18M16 9v15" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="9" r="3" /><circle cx="7" cy="22" r="2.5" /><circle cx="25" cy="22" r="2.5" /><circle cx="16" cy="24" r="2" />
    </svg>
  )
}

/** 知识花园、会客厅、留言板共用的公开站点导航。 */
export default function PublicNav({ active, isLoggedIn = false }) {
  const { mode, toggle } = useTheme()
  return (
    <header className="public-nav-shell">
      <Link to="/blog" className="public-nav-brand" aria-label="返回 MindWeave 公开首页">
        <span className="public-nav-mark"><WeaveMark /></span>
        <span><strong>MindWeave 织脑</strong><small>个人知识与生活工作台</small></span>
      </Link>
      <nav className="public-nav-links" aria-label="公开站点导航">
        <Link to="/blog" className={active === 'blog' ? 'is-active' : ''}>知识花园</Link>
        <Link to="/community" className={active === 'community' ? 'is-active' : ''}><IconComment />会客厅</Link>
        <Link to="/guestbook" className={active === 'guestbook' ? 'is-active' : ''}><IconMail />留言板</Link>
      </nav>
      <div className="public-nav-actions">
        <Button theme="borderless" icon={mode === 'dark' ? <IconSun /> : <IconMoon />} onClick={toggle} aria-label={mode === 'dark' ? '切换明亮模式' : '切换夜间模式'} />
        <Link to={isLoggedIn ? '/home' : '/login'} className="public-nav-workspace">{isLoggedIn ? '返回工作台' : '进入工作台'}</Link>
      </div>
    </header>
  )
}
