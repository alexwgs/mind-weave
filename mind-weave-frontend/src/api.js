import axios from 'axios'
import { Toast } from '@douyinfe/semi-ui'

const http = axios.create({ baseURL: '/api', timeout: 60000 })

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('salary_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && typeof body.code !== 'undefined') {
      if (body.code === 0) return body.data
      Toast.error(body.message || '请求失败')
      return Promise.reject(new Error(body.message))
    }
    return body
  },
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('salary_token')
      localStorage.removeItem('salary_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    } else if (err.response && err.response.status === 403) {
      if (localStorage.getItem('salary_token')) {
        // 本地有 token 但仍 403，视为登录态失效，跳转登录页
        localStorage.removeItem('salary_token')
        localStorage.removeItem('salary_user')
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      } else {
        Toast.error('没有权限执行该操作')
      }
    } else {
      Toast.error(err.response?.data?.message || err.message || '网络错误')
    }
    return Promise.reject(err)
  }
)

export default http

export const authApi = {
  login: (data) => http.post('/auth/login', data),
  me: () => http.get('/auth/me'),
  changePassword: (data) => http.put('/auth/password', data)
}

export const recordApi = {
  page: (params) => http.get('/records', { params }),
  detail: (id) => http.get(`/records/${id}`),
  create: (data) => http.post('/records', data),
  update: (id, data) => http.put(`/records/${id}`, data),
  remove: (id) => http.delete(`/records/${id}`)
}

export const commentApi = {
  page: (params) => http.get('/comments', { params }),
  create: (data) => http.post('/comments', data),
  update: (id, data) => http.put(`/comments/${id}`, data),
  remove: (id) => http.delete(`/comments/${id}`)
}

export const statsApi = {
  overview: (params) => http.get('/stats/overview', { params }),
  annual: (params) => http.get('/stats/annual', { params }),
  trend: (params) => http.get('/stats/trend', { params })
}

export const importApi = {
  preview: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post('/import/preview', fd)
  },
  execute: (file, mode) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', mode)
    return http.post('/import/execute', fd)
  },
  batches: (params) => http.get('/import/batches', { params })
}

export const exportApi = {
  download: (params) => http.get('/export/records', { params, responseType: 'blob' })
}

export const userApi = {
  list: () => http.get('/users'),
  create: (data) => http.post('/users', data),
  update: (id, data) => http.put(`/users/${id}`, data),
  resetPassword: (id, newPassword) => http.post(`/users/${id}/reset-password`, { newPassword }),
  remove: (id) => http.delete(`/users/${id}`)
}

export const permApi = {
  list: () => http.get('/permissions'),
  roleDefaults: () => http.get('/permissions/roles')
}

export const aiApi = {
  chat: (messages) => http.post('/ai/chat', { messages }),
  config: () => http.get('/ai/config'),
  test: (payload) => http.post('/ai/test', payload)
}

export const logApi = {
  page: (params) => http.get('/logs', { params })
}

export const apiManagerApi = {
  catalog: () => http.get('/admin/apis'),
  toggle: (method, path, enabled) => http.post('/admin/apis/toggle', { method, path, enabled }),
  execute: async ({ method, path, query, body }) => {
    const params = new URLSearchParams()
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
    })
    const url = path + (params.size ? `${path.includes('?') ? '&' : '?'}${params}` : '')
    const headers = { Accept: 'application/json, text/plain, */*' }
    const token = localStorage.getItem('salary_token')
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined && body !== null && !['GET', 'HEAD'].includes(method)) headers['Content-Type'] = 'application/json'
    const startedAt = performance.now()
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined && body !== null && !['GET', 'HEAD'].includes(method) ? JSON.stringify(body) : undefined
    })
    const duration = Math.round(performance.now() - startedAt)
    const contentType = response.headers.get('content-type') || ''
    let payload
    if (contentType.includes('application/json')) payload = await response.json()
    else if (contentType.startsWith('text/')) payload = await response.text()
    else payload = { binary: true, contentType, contentLength: response.headers.get('content-length') }
    return { ok: response.ok, status: response.status, statusText: response.statusText, duration, contentType, payload }
  }
}

const visitorToken = () => {
  let token = localStorage.getItem('mindweave_visitor_token')
  if (!token) {
    token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('mindweave_visitor_token', token)
  }
  return token
}

export const communityApi = {
  rooms: () => http.get('/community/public/rooms'),
  messages: (roomId, params) => http.get(`/community/public/rooms/${roomId}/messages`, { params }),
  postMessage: (roomId, data) => http.post(`/community/public/rooms/${roomId}/messages`, { ...data, visitorToken: visitorToken() }),
  // 实时能力：EventSource 无法自定义请求头，所以流地址在 realtime.js 里单独拼装
  presence: (roomId, data) => http.post(`/community/public/rooms/${roomId}/presence`, { ...data, visitorToken: visitorToken() }),
  leaveRoom: (roomId, data) => http.post(`/community/public/rooms/${roomId}/presence/leave`, data),
  typing: (roomId, data) => http.post(`/community/public/rooms/${roomId}/typing`, data),
  guestbook: (params) => http.get('/community/public/guestbook', { params }),
  postGuestbook: (data) => http.post('/community/public/guestbook', { ...data, visitorToken: visitorToken() }),
  articleComments: (articleId, params) => http.get(`/community/public/articles/${articleId}/comments`, { params }),
  postArticleComment: (articleId, data) => http.post(`/community/public/articles/${articleId}/comments`, { ...data, visitorToken: visitorToken() }),
  moderation: (params) => http.get('/community/admin/moderation', { params }),
  review: (type, id, status) => http.put(`/community/admin/moderation/${type}/${id}`, { status }),
  deletePost: (type, id) => http.delete(`/community/admin/moderation/${type}/${id}`),
  adminRooms: () => http.get('/community/admin/rooms'),
  createRoom: (data) => http.post('/community/admin/rooms', data),
  updateRoom: (id, data) => http.put(`/community/admin/rooms/${id}`, data)
}

// ==================== MindWeave · 织脑 ====================
export const toolApi = {
  // 保险箱
  vaultGroups: () => http.get('/tool/vault/groups'),
  vaultGroupSummary: () => http.get('/tool/vault/groups/summary'),
  createVaultGroup: (d) => http.post('/tool/vault/groups', d),
  updateVaultGroup: (id, d) => http.put(`/tool/vault/groups/${id}`, d),
  deleteVaultGroup: (id) => http.delete(`/tool/vault/groups/${id}`),
  vaultItems: (params) => http.get('/tool/vault/items', { params }),
  vaultReveal: (id) => http.get(`/tool/vault/items/${id}/reveal`),
  createVaultItem: (d) => http.post('/tool/vault/items', d),
  updateVaultItem: (id, d) => http.put(`/tool/vault/items/${id}`, d),
  deleteVaultItem: (id) => http.delete(`/tool/vault/items/${id}`),
  setPin: (pin) => http.put('/tool/vault/pin', { pin }),
  verifyPin: (pin) => http.post('/tool/vault/pin/verify', { pin }),

  // 附件
  uploadAttachment: (file, bizType, bizId) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('bizType', bizType)
    if (bizId) fd.append('bizId', bizId)
    return http.post('/tool/attachments', fd)
  },
  listAttachments: (params) => http.get('/tool/attachments', { params }),
  deleteAttachment: (id) => http.delete(`/tool/attachments/${id}`),
  attachmentUrl: (id, mode = 'content') => `/api/tool/attachments/${id}/${mode}`,

  // 文章
  categories: () => http.get('/tool/categories'),
  createCategory: (d) => http.post('/tool/categories', d),
  updateCategory: (id, d) => http.put(`/tool/categories/${id}`, d),
  deleteCategory: (id) => http.delete(`/tool/categories/${id}`),
  articles: (params) => http.get('/tool/articles', { params }),
  article: (id) => http.get(`/tool/articles/${id}`),
  createArticle: (d) => http.post('/tool/articles', d),
  updateArticle: (id, d) => http.put(`/tool/articles/${id}`, d),
  deleteArticle: (id) => http.delete(`/tool/articles/${id}`),
  shareArticle: (id, d) => http.post(`/tool/articles/${id}/share`, d),
  disableShare: (id) => http.delete(`/tool/articles/${id}/share`),
  accessShare: (token, password) => http.post(`/tool/share/${token}`, { password }),
  publicArticles: (params) => http.get('/tool/articles/public', { params }),
  publicArticle: (id) => http.get(`/tool/articles/public/${id}`),
  publicCategories: () => http.get('/tool/articles/public/categories'),
  articleCovers: (params) => http.get('/tool/articles/covers', { params }),

  // 待办
  todos: (params) => http.get('/tool/todos', { params }),
  todoCalendar: (month) => http.get('/tool/todos/calendar', { params: { month } }),
  todoProjects: () => http.get('/tool/todos/projects'),
  todoSummary: () => http.get('/tool/todos/summary'),
  todoSchedulerStatus: () => http.get('/tool/todos/scheduler-status'),
  createTodo: (d) => http.post('/tool/todos', d),
  updateTodo: (id, d) => http.put(`/tool/todos/${id}`, d),
  deleteTodo: (id) => http.delete(`/tool/todos/${id}`),
  toggleTodo: (id) => http.post(`/tool/todos/${id}/toggle`),
  toggleSub: (id, sid) => http.post(`/tool/todos/${id}/subs/${sid}/toggle`),

  // 人生 RPG
  rpg: () => http.get('/tool/rpg'),
  createRpgHabit: (d) => http.post('/tool/rpg/habits', d),
  toggleRpgHabit: (id) => http.post(`/tool/rpg/habits/${id}/toggle`),
  deleteRpgHabit: (id) => http.delete(`/tool/rpg/habits/${id}`),

  // 设置
  settings: () => http.get('/tool/settings'),
  saveSettings: (d) => http.put('/tool/settings', d),
  testBark: (barkUrl) => http.post('/tool/settings/bark-test', { barkUrl }),
  wxConfig: () => http.get('/tool/settings/wx-config')
}
