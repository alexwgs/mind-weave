import TurndownService from 'turndown'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
turndown.addRule('video', {
  filter: 'video',
  replacement: (_, node) => {
    const src = node.getAttribute('src') || node.querySelector('source')?.getAttribute('src') || ''
    const attachment = src.match(/\/attachments\/(\d+)\/content/)
    return attachment ? `\n@video(attachment:${attachment[1]})\n` : `\n[视频](${src})\n`
  }
})

export const splitTags = (tags) => [...new Set(String(tags || '').split(/[,，]/).map(t => t.trim()).filter(Boolean))]
export const htmlToMarkdown = (html) => turndown.turndown(html || '')
export const articleMarkdown = (article) => article.contentMd || htmlToMarkdown(article.contentHtml)

export function readingStats(text) {
  const plain = String(text || '').replace(/<[^>]*>/g, ' ').replace(/&[\w#]+;/g, ' ')
  const chinese = (plain.match(/[\u3400-\u9fff]/g) || []).length
  const words = (plain.replace(/[\u3400-\u9fff]/g, ' ').match(/[\p{L}\p{N}]+/gu) || []).length
  const count = chinese + words
  return { count, minutes: Math.max(1, Math.ceil(count / 300)) }
}

export function draftKey(user, articleId) {
  const identity = user?.username || user?.id
  return identity == null ? null : `salary:article-draft:v1:${encodeURIComponent(identity)}:${articleId || 'new'}`
}

export function readDraft(storage, key) {
  if (!key) return null
  try {
    const draft = JSON.parse(storage.getItem(key) || 'null')
    return draft?.version === 1 && draft.form && typeof draft.form.title === 'string'
      && typeof draft.md === 'string' && typeof draft.html === 'string' ? draft : null
  } catch { return null }
}

export function downloadMarkdown(article) {
  const content = `# ${article.title || '未命名文章'}\n\n${articleMarkdown(article)}`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${String(article.title || '未命名文章').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 100)}.md`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Treat saved rich text as content: retain formatting while removing executable markup.
export function prepareReadingHtml(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed,form,input,button,meta,link,base,svg,math').forEach(el => el.remove())
  doc.body.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || ['srcdoc', 'id', 'name', 'srcset'].includes(name)) el.removeAttribute(attr.name)
      if (['href', 'src', 'poster', 'xlink:href'].includes(name)) {
        const value = attr.value.replace(/[\s\u0000-\u001f]+/g, '')
        if (!/^(https?:\/\/|\/[^/]|#|mailto:|attachment:\d+$)/i.test(value)) el.removeAttribute(attr.name)
      }
      if (name === 'style' && /url\s*\(|expression\s*\(|position\s*:\s*fixed/i.test(attr.value)) el.removeAttribute('style')
    }
    if (el.tagName === 'A') el.setAttribute('rel', 'noopener noreferrer')
  })
  const headings = [...doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((el, index) => {
    const id = `article-heading-${index + 1}`
    el.id = id
    return { id, title: el.textContent.trim(), level: Number(el.tagName[1]) }
  }).filter(h => h.title)
  return { html: doc.body.innerHTML, headings, ...readingStats(doc.body.textContent) }
}

export const ARTICLE_TEMPLATES = [
  { id: 'note', label: '学习笔记', content: '## 这次学到了什么\n\n用自己的话说明核心概念。\n\n## 关键知识\n\n- \n\n## 实践与示例\n\n\n## 下一步\n\n- [ ] \n\n## 参考资料\n\n' },
  { id: 'review', label: '复盘记录', content: '## 目标与背景\n\n\n## 实际结果\n\n\n## 做得好的地方\n\n- \n\n## 遇到的问题\n\n- \n\n## 接下来的行动\n\n- [ ] \n' },
  { id: 'guide', label: '操作指南', content: '## 适用场景\n\n\n## 准备工作\n\n- [ ] \n\n## 操作步骤\n\n1. \n2. \n3. \n\n## 常见问题\n\n\n## 参考链接\n\n' }
]
