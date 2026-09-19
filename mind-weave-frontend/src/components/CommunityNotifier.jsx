import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { communityApi } from '../api'

const STORAGE_KEY = 'mindweave_room_last_seen'

/** 离开会客厅后继续轻量检查新消息；仅在用户已授权浏览器通知时工作。 */
export default function CommunityNotifier() {
  const location = useLocation()
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname

  useEffect(() => {
    let stopped = false
    let last = {}
    try { last = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {} } catch { last = {} }

    const check = async () => {
      if (stopped || typeof Notification === 'undefined' || Notification.permission !== 'granted' || pathRef.current.startsWith('/community')) return
      try {
        const rooms = await communityApi.rooms()
        for (const room of rooms) {
          const page = await communityApi.messages(room.id, { page: 1, size: 1 })
          const message = page.records?.[0]
          if (!message) continue
          const previous = Number(last[room.id] || 0)
          if (previous && Number(message.id) > previous) {
            const notice = new Notification(`${message.authorName} · ${room.name}`, {
              body: String(message.content || '').replace(/!?\[([^\]]*)\]\(attachment:\d+[^)]*\)/g, '[$1]').slice(0, 140),
              tag: `mindweave-room-${room.id}`
            })
            notice.onclick = () => { window.focus(); window.location.href = '/community'; notice.close() }
          }
          last[room.id] = message.id
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(last))
      } catch { /* 后台检查失败不打扰当前页面 */ }
    }
    check()
    const timer = window.setInterval(check, 8000)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [])
  return null
}
