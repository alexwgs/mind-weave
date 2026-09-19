/**
 * 会客厅实时客户端。
 *
 * 之前是每 6 秒轮询一次消息接口，人多时请求量成倍增长；
 * 现在改为一条 SSE 长连接：新消息、在线列表、输入中提示都由服务端推送。
 *
 * 关于 Kafka：Kafka 是后端到后端的传输层，浏览器说不了 Kafka 协议，
 * 所以到达前端的这一段仍然必须是 SSE（或 WebSocket）。后端已把广播抽象成
 * RealtimeBroadcaster 接口，将来接入 Kafka 时这一层不需要改。
 */

export const VISITOR_TOKEN_KEY = 'mindweave_visitor_token'
export const GUEST_NAME_KEY = 'mindweave_guest_name'

/** 后端 community.realtime.enabled=false 时前端退回轮询 */
const REALTIME_ENABLED = true
const POLL_INTERVAL_MS = 6000
const NICKNAME_MAX = 24

export function visitorToken() {
  let token = localStorage.getItem(VISITOR_TOKEN_KEY)
  if (!token) {
    token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(VISITOR_TOKEN_KEY, token)
  }
  return token
}

/** 在线身份的稳定 id：同一个浏览器重连后仍视为同一个人，不会在列表里重复出现 */
export function viewerId() {
  return visitorToken()
}

export function guestName() {
  return localStorage.getItem(GUEST_NAME_KEY) || ''
}

export function rememberGuestName(name) {
  const trimmed = (name || '').trim()
  if (trimmed) localStorage.setItem(GUEST_NAME_KEY, trimmed)
  return trimmed
}

function buildStreamUrl(roomId, nickname) {
  const url = new URL(`/api/community/public/rooms/${roomId}/stream`, window.location.origin)
  url.searchParams.set('viewerId', viewerId())
  // nickname 只用于 SSE 断线重连时的游客兜底，不承载认证；JWT 绝不放进 URL。
  // 登录成员身份由建立连接前的 presence HTTP 请求用 Authorization Header 登记。
  if (nickname) url.searchParams.set('nickname', nickname.slice(0, NICKNAME_MAX))
  return url.toString()
}

/**
 * 订阅房间实时流。
 * @returns {{close: () => void, reconnect: () => void, pollFallback: () => void}}
 */
export function openRoomStream(roomId, { nickname, onViewers, onEvent, onStatus }) {
  if (!REALTIME_ENABLED || typeof EventSource === 'undefined') {
    onStatus?.('polling')
    const timer = setInterval(() => onEvent?.({ kind: 'poll' }), POLL_INTERVAL_MS)
    return { close: () => clearInterval(timer), reconnect: () => {}, pollFallback: () => {} }
  }

  let source = null
  let attempts = 0
  let closed = false
  let pollTimer = null

  const startPolling = () => {
    if (closed || pollTimer) return
    onStatus?.('polling')
    pollTimer = setInterval(() => onEvent?.({ kind: 'poll' }), POLL_INTERVAL_MS)
  }

  const stopPolling = () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  const connect = () => {
    if (closed) return
    onStatus?.(attempts === 0 ? 'connecting' : 'reconnecting')
    source = new EventSource(buildStreamUrl(roomId, nickname))

    source.addEventListener('room', (message) => {
      attempts = 0
      stopPolling()
      onStatus?.('live')
      try {
        const payload = JSON.parse(message.data)
        if (Array.isArray(payload.viewers)) onViewers?.(payload.viewers)
        if (payload.event) onEvent?.(payload.event)
      } catch {
        // 单帧解析失败不应中断连接
      }
    })

    source.onopen = () => { attempts = 0; onStatus?.('live') }

    source.onerror = () => {
      if (closed) return
      // 浏览器会自动重连（CLOSED 表示不会重试）；连续失败则退回轮询兜底
      if (source.readyState === EventSource.CLOSED) {
        attempts += 1
        onStatus?.('reconnecting')
        if (attempts >= 3) {
          source.close()
          startPolling()
          return
        }
        setTimeout(connect, 3000)
      } else {
        onStatus?.('reconnecting')
      }
    }
  }

  connect()

  return {
    close() {
      closed = true
      stopPolling()
      if (source) source.close()
      onStatus?.('closed')
    },
    reconnect() {
      if (closed) return
      attempts = 0
      stopPolling()
      if (source) source.close()
      connect()
    },
    pollFallback: startPolling
  }
}
