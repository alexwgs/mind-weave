// Markdown for personal notes, including attachment images and video references.
const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const safeUrl = (url) => /^(https?:\/\/|\/[^/]|#|mailto:)/i.test(url.trim()) ? esc(url.trim()) : ''
const escAttr = (value) => esc(value).replace(/\r?\n/g, ' ')

/** 人类可读的文件大小，用在附件链接上 */
function formatSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** 附件文件链接：[说明](attachment:ID "size=123")，PDF/Word/Excel/压缩包等任意类型通用 */
function fileLink(label, id, size) {
  const text = label || '附件'
  const meta = formatSize(size)
  return `<a class="knowledge-file" href="/api/tool/attachments/${id}/download" download>`
    + '<span class="knowledge-file-icon" aria-hidden="true">📎</span>'
    + `<span class="knowledge-file-name">${esc(text)}</span>`
    + (meta ? `<span class="knowledge-file-size">${esc(meta)}</span>` : '')
    + '<span class="knowledge-file-action">下载</span>'
    + '</a>'
}

function inline(source) {
  const saved = []
  const token = (html) => `\u0000${saved.push(html) - 1}\u0000`
  let text = String(source).replace(/\u0000/g, '')
  text = text.replace(/`([^`]+)`/g, (_, value) => token(`<code>${esc(value)}</code>`))
  // 图片与文件都写成 [说明](attachment:ID)，用可选的 "size=…" 属性区分二者
  text = text.replace(/!?\[([^\]]*)\]\(attachment:(\d+)(?:\s+"([^"]*)")?\)/g, (_, label, id, title) => {
    const size = /(?:^|;)\s*size=(\d+)/.exec(title || '')
    if (size) return token(fileLink(label, id, size[1]))
    return token(`<img src="/api/tool/attachments/${id}/content" alt="${escAttr(label)}" loading="lazy" style="max-width:100%;border-radius:8px;"/>`)
  })
  text = text.replace(/@video\(attachment:(\d+)\)/g, (_, id) => token(`<video src="/api/tool/attachments/${id}/content" controls style="max-width:100%;border-radius:8px;"></video>`))
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const url = safeUrl(src)
    return token(url ? `<img src="${url}" alt="${escAttr(alt)}" loading="lazy" style="max-width:100%;border-radius:8px;"/>` : esc(alt))
  })
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const url = safeUrl(href)
    return token(url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label))
  })
  text = esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/~~([^~]+)~~/g, '<del>$1</del>').replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => saved[Number(index)])
}

export function renderMarkdown(md) {
  if (!md) return '<p>（空内容）</p>'
  const lines = String(md).split(/\r?\n/)
  const out = []
  let code = null
  let list = null
  let quote = false
  const closeList = () => { if (list) out.push(`</${list}>`); list = null }
  const closeQuote = () => { if (quote) out.push('</blockquote>'); quote = false }
  const closeBlocks = () => { closeList(); closeQuote() }
  const emitCode = () => out.push(`<pre style="background:#25304a;color:#f6f7fb;padding:16px;border-radius:10px;overflow-x:auto;"><code>${code.join('\n')}</code></pre>`)
  const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map(s => s.trim())
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd()
    if (/^\s*```/.test(line)) {
      if (code) { emitCode(); code = null } else { closeBlocks(); code = [] }
      continue
    }
    if (code) { code.push(esc(line)); continue }
    if (line.includes('|') && i + 1 < lines.length && cells(lines[i + 1]).every(c => /^:?-{3,}:?$/.test(c))) {
      closeBlocks()
      out.push('<table><thead><tr>' + cells(line).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>')
      i += 2
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        out.push('<tr>' + cells(lines[i]).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>'); i++
      }
      i--
      out.push('</tbody></table>')
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) { closeBlocks(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue }
    const item = line.match(/^\s*(?:([-*+])|\d+\.)\s+(.*)$/)
    if (item) {
      const type = item[1] ? 'ul' : 'ol'
      if (list !== type) { closeBlocks(); list = type; out.push(`<${type}>`) }
      const task = item[2].match(/^\[([ xX])\]\s?(.*)$/)
      out.push(task ? `<li class="knowledge-task-item"><span aria-label="${task[1] === ' ' ? '未完成' : '已完成'}">${task[1] === ' ' ? '☐' : '☑'}</span> ${inline(task[2])}</li>` : `<li>${inline(item[2])}</li>`)
      continue
    }
    if (/^>\s?/.test(line)) {
      closeList()
      if (!quote) { out.push('<blockquote>'); quote = true }
      out.push(`<p>${inline(line.replace(/^>\s?/, ''))}</p>`)
      continue
    }
    closeBlocks()
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr/>'); continue }
    if (line.trim()) out.push(`<p>${inline(line)}</p>`)
  }
  closeBlocks()
  if (code) emitCode()
  return out.join('\n')
}
