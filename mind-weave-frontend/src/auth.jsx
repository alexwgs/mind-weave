import { createContext, useContext, useState } from 'react'
import { authApi } from './api'

const AuthContext = createContext(null)

// 兼容旧登录态（未含权限列表时按角色兜底，与后端种子一致）
const ROLE_FALLBACK = {
  ADMIN: null, // 管理员全部放行
  MANAGER: ['home', 'dashboard', 'records', 'records.view', 'records.create', 'records.edit', 'records.delete',
    'records.export', 'comments', 'comments.create', 'comments.edit', 'comments.delete', 'import',
    'import.execute', 'stats', 'vault', 'vault.view', 'vault.create', 'vault.edit', 'vault.delete',
    'articles', 'article.view', 'article.create', 'article.edit', 'article.delete', 'todos',
    'todo.create', 'todo.edit', 'todo.delete'],
  USER: ['home', 'dashboard', 'records', 'records.view', 'comments', 'stats', 'vault', 'vault.view',
    'vault.create', 'vault.edit', 'vault.delete', 'articles', 'article.view', 'article.create',
    'article.edit', 'article.delete', 'todos', 'todo.create', 'todo.edit', 'todo.delete']
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('salary_user') || 'null')
    } catch {
      return null
    }
  })

  const login = async (username, password) => {
    const data = await authApi.login({ username, password })
    localStorage.setItem('salary_token', data.token)
    localStorage.setItem('salary_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('salary_token')
    localStorage.removeItem('salary_user')
    setUser(null)
  }

  const role = user?.role || 'VIEWER'
  const permissions = Array.isArray(user?.permissions)
    ? user.permissions
    : (ROLE_FALLBACK[role] || [])
  const can = (code) => {
    if (!user) return false
    if (role === 'ADMIN') return true
    return permissions.includes(code)
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        role,
        permissions,
        can,
        isAdmin: role === 'ADMIN',
        canEdit: role === 'ADMIN' || role === 'MANAGER'
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
