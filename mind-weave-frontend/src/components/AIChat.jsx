import { useCallback, useEffect, useRef, useState } from 'react'
import { AIChatDialogue, Avatar, Button, Input, Tag, Toast } from '@douyinfe/semi-ui'
import { IconClear, IconComment, IconSend } from '@douyinfe/semi-icons'
import { aiApi } from '../api'

const SUGGESTIONS = [
  '帮我新建一个待办：明天上午交周报',
  '查询一下我的待办',
  '我的知识库里有哪些关于信用卡投诉的笔记？',
  '查询本月工资汇总'
]

const SIZE_KEY = 'salary:ai-panel-size:v1'
const MIN_W = 300
const MIN_H = 320

/** 面板尺寸限制在视口内，窗口变小或换了屏幕也不会溢出 */
function clampSize(size) {
  const maxW = Math.max(MIN_W, Math.min(920, (typeof window === 'undefined' ? 1280 : window.innerWidth) - 32))
  const maxH = Math.max(MIN_H, Math.min(940, (typeof window === 'undefined' ? 900 : window.innerHeight) - 96))
  return {
    w: Math.round(Math.min(Math.max(size.w, MIN_W), maxW)),
    h: Math.round(Math.min(Math.max(size.h, MIN_H), maxH))
  }
}

function readStoredSize() {
  try {
    const raw = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null')
    if (raw && Number.isFinite(raw.w) && Number.isFinite(raw.h)) return raw
  } catch { /* 存储不可用时用默认尺寸 */ }
  return null
}

/**
 * 处理手柄拖拽。左下角向左/下变大，左上角向左/上变大，
 * 面板固定右下角锚点，所以只改宽高即可。
 */
function useResize(size, setSize, onResizeStart) {
  const stateRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const start = useCallback((axis) => (e) => {
    e.preventDefault()
    stateRef.current = { axis, x: e.clientX, y: e.clientY, startW: size.w, startH: size.h }
    if (onResizeStart) onResizeStart()
    setDragging(true)
  }, [size.w, size.h, onResizeStart])

  useEffect(() => {
    if (!dragging) return undefined
    const onMove = (e) => {
      const s = stateRef.current
      if (!s) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      // 面板贴右边，指针往左移动 => 面板变宽
      const next = { w: s.startW - dx, h: s.startH }
      if (s.axis === 'left-top') next.h = s.startH - dy
      if (s.axis === 'left-bottom') next.h = s.startH + dy
      setSize(clampSize(next))
    }
    const stop = () => {
      setDragging(false)
      stateRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [dragging, setSize])

  return { start, dragging }
}

export default function AIChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [size, setSize] = useState(() => clampSize(readStoredSize() || { w: 460, h: 600 }))
  const dialogueRef = useRef(null)
  // 只有用户手动拖过才写回存储，避免窗口缩放导致的自动收窄把用户尺寸覆盖掉
  const resizedRef = useRef(false)

  const markResized = useCallback(() => { resizedRef.current = true }, [])
  const { start, dragging } = useResize(size, setSize, markResized)

  useEffect(() => {
    dialogueRef.current?.scrollToBottom?.(false)
  }, [messages, loading])

  // 窗口缩放时把面板收回可视范围
  useEffect(() => {
    const onResize = () => setSize((s) => clampSize(s))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 记住用户调好的大小
  useEffect(() => {
    if (!resizedRef.current) return
    try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)) } catch { /* 忽略存储失败 */ }
  }, [size])

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    const history = [...messages, { id: globalThis.crypto?.randomUUID?.() || `user-${Date.now()}`, role: 'user', content, status: 'completed', createdAt: Date.now() }]
    setMessages(history)
    setLoading(true)
    try {
      const res = await aiApi.chat(history.map((m) => ({ role: m.role, content: m.content })))
      setMessages((m) => [...m, { id: globalThis.crypto?.randomUUID?.() || `assistant-${Date.now()}`, role: 'assistant', content: res.reply, actions: res.actions || [], status: 'completed', createdAt: Date.now() }])
    } catch (e) {
      setMessages((m) => [...m, { id: globalThis.crypto?.randomUUID?.() || `error-${Date.now()}`, role: 'assistant', content: '抱歉，出错了：' + (e.message || '未知错误'), status: 'failed', createdAt: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <div
          className={`ai-panel${dragging ? ' is-resizing' : ''}`}
          style={{ width: size.w, height: size.h }}
          role="dialog"
          aria-label="AI 助手"
        >
          <span
            className="ai-grip ai-grip-left-top"
            onPointerDown={start('left-top')}
            role="separator"
            aria-label="拖动调整窗口大小"
            title="拖动调整窗口大小"
          />
          <span
            className="ai-grip ai-grip-left-bottom"
            onPointerDown={start('left-bottom')}
            role="separator"
            aria-label="拖动调整窗口大小"
            title="拖动调整窗口大小"
          />

          <div className="ai-panel-head">
            <span className="ai-panel-title">🤖 AI 助手</span>
            <span className="ai-panel-actions">
              <Button size="small" theme="borderless" icon={<IconClear />} onClick={() => setMessages([])} style={{ color: '#fff' }} aria-label="清空对话" />
              <Button size="small" theme="borderless" onClick={() => setOpen(false)} style={{ color: '#fff' }} aria-label="关闭">✕</Button>
            </span>
          </div>

          <div className="ai-panel-body">
            <AIChatDialogue
              ref={dialogueRef}
              className="workspace-ai-dialogue"
              chats={loading ? [...messages, { id: 'thinking', role: 'assistant', content: '正在思考…', status: 'in_progress' }] : messages}
              roleConfig={{ user: { name: '我' }, assistant: { name: 'MindWeave AI' } }}
              align="leftRight"
              mode="bubble"
              hints={messages.length || loading ? [] : SUGGESTIONS}
              onHintClick={send}
              escapeHtml
              showReset
              onMessageReset={(message) => message?.role === 'assistant' && send(messages.slice().reverse().find((item) => item.role === 'user')?.content)}
              onMessageCopy={async (message) => { await navigator.clipboard.writeText(String(message?.content || '')); Toast.success('已复制') }}
              dialogueRenderConfig={{
                renderDialogueAvatar: ({ message }) => <Avatar size="small" color={message?.role === 'user' ? 'blue' : 'violet'}>{message?.role === 'user' ? '我' : 'AI'}</Avatar>,
                renderDialogueContent: ({ message, defaultContent }) => <div className="workspace-ai-content">{defaultContent}{message?.actions?.length > 0 && <div className="ai-actions"><Tag size="small" color="blue">已调用 {message.actions.length} 个工具</Tag>{message.actions.slice(0, 3).map((action, index) => <div className="ai-action-line" key={index}>{action}</div>)}</div>}</div>
              }}
              markdownRenderProps={{ linkTarget: '_blank' }}
            />
          </div>

          <div className="ai-panel-foot">
            <div className="ai-suggestions">
              {messages.length > 0 && SUGGESTIONS.map((s) => (
                <Tag key={s} className="ai-suggestion" color="blue" onClick={() => send(s)}>{s}</Tag>
              ))}
            </div>
            <div className="ai-input-row">
              <Input placeholder="输入你的需求…" value={input} onChange={setInput} onEnterPress={() => send()} style={{ flex: 1 }} />
              <Button type="primary" icon={<IconSend />} disabled={loading} onClick={() => send()} aria-label="发送" />
            </div>
          </div>
        </div>
      )}
      <Button
        theme="solid"
        icon={<IconComment size="large" />}
        onClick={() => setOpen(!open)}
        aria-label="打开 AI 助手"
        style={{
          position: 'fixed', right: 24, bottom: 24, width: 56, height: 56, borderRadius: '50%', zIndex: 999,
          background: 'linear-gradient(135deg, #0061ff, #7d5fff)', boxShadow: '0 8px 24px rgba(102,77,255,.4)'
        }}
      />
    </>
  )
}
