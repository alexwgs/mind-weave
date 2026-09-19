// 小程序版 Markdown → HTML（用于 rich-text 渲染）
// 图片：![说明](attachment:ID)，需先通过 downloadAttachment 下载后传入 imgMap

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveInline(s, imgMap) {
  return String(s)
    .replace(/!\[([^\]]*)\]\(attachment:(\d+)\)/g, (m, alt, id) => {
      const src = imgMap[id] || ''
      return src ? `<img src="${src}" style="max-width:100%;border-radius:8px;margin:8px 0;"/>` : `[图片${id}]`
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, href) => {
      return /^(https?:|attachment:)/.test(href) ? `<a href="${href}">${t}</a>` : t
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function renderMarkdownMp(md, imgMap) {
  if (!md) return '<p style="color:#999;">（空内容）</p>'
  const lines = String(md).split(/\r?\n/)
  const out = []
  let inCode = false
  let codeBuf = []
  let inList = false
  let listType = 'ul'

  const closeList = () => {
    if (inList) { out.push('</' + listType + '>'); inList = false }
  }

  lines.forEach((raw) => {
    const line = raw.replace(/\s+$/, '')
    if (line.startsWith('```')) {
      if (inCode) {
        out.push('<pre><code>' + codeBuf.join('\n') + '</code></pre>')
        codeBuf = []
        inCode = false
      } else {
        closeList()
        inCode = true
      }
      return
    }
    if (inCode) { codeBuf.push(esc(line)); return }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      closeList()
      out.push('<h' + h[1].length + '>' + resolveInline(esc(h[2]), imgMap) + '</h' + h[1].length + '>')
      return
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { inList = true; listType = 'ul'; out.push('<ul>') }
      out.push('<li>' + resolveInline(esc(line.replace(/^\s*[-*]\s+/, '')), imgMap) + '</li>')
      return
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inList) { inList = true; listType = 'ol'; out.push('<ol>') }
      out.push('<li>' + resolveInline(esc(line.replace(/^\s*\d+\.\s+/, '')), imgMap) + '</li>')
      return
    }
    if (line.startsWith('> ')) {
      out.push('<blockquote>' + resolveInline(esc(line.slice(2)), imgMap) + '</blockquote>')
      return
    }
    closeList()
    if (!line.trim()) return
    out.push('<p>' + resolveInline(esc(line), imgMap) + '</p>')
  })
  closeList()
  if (inCode) out.push('<pre><code>' + codeBuf.join('\n') + '</code></pre>')
  return out.join('\n')
}

module.exports = { renderMarkdownMp }
