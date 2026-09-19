import { useMemo, useRef, useState } from 'react'
import { Button, Space, Tag, Toast } from '@douyinfe/semi-ui'
import { articleMarkdown, downloadMarkdown, prepareReadingHtml, splitTags } from '../utils/knowledge'
import { renderMarkdown } from '../utils/markdown'
import '../knowledge.css'

export default function KnowledgeReader({ article, actions }) {
  // 未开启分享时后端只回传预览片段，正文与目录都不该出现
  const shared = article.shared !== false
  const source = shared
    ? (article.contentHtml || renderMarkdown(article.contentMd))
    : (article.previewHtml || '')
  const content = useMemo(() => prepareReadingHtml(source), [source])
  const [activeHeading, setActiveHeading] = useState('')
  const bodyRef = useRef(null)
  const goTo = (id) => {
    setActiveHeading(id)
    bodyRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
  return (
    <div className="knowledge-reader">
      <div className="knowledge-reader-tools">
        <Space wrap>{actions}</Space>
        {shared && (
          <Space wrap>
            <Button theme="borderless" onClick={async () => {
              try { await navigator.clipboard.writeText(`# ${article.title}\n\n${articleMarkdown(article)}`); Toast.success('Markdown 已复制') }
              catch { Toast.warning('复制失败，可使用导出 Markdown 保存文章') }
            }}>复制 Markdown</Button>
            <Button onClick={() => downloadMarkdown(article)}>导出 Markdown</Button>
          </Space>
        )}
      </div>
      <div className={`knowledge-reading-layout ${content.headings.length ? 'has-toc' : ''}`}>
        <article className="knowledge-reading-paper">
          <div className="knowledge-eyebrow">{article.categoryPath || '知识笔记'}</div>
          <h1>{article.title}</h1>
          <div className="knowledge-reading-meta">
            <span>更新于 {String(article.updatedAt || article.createdAt || '').replace('T', ' ').slice(0, 16)}</span>
            {shared
              ? <span>{content.count.toLocaleString()} 字 · 约 {content.minutes} 分钟</span>
              : <span>约 {article.readingMinutes || 1} 分钟</span>}
            <span>{article.viewCount || 0} 次浏览</span>
            {!shared && <span className="knowledge-locked-chip">仅预览</span>}
          </div>
          {splitTags(article.tags).length > 0 && <Space wrap className="knowledge-reading-tags">{splitTags(article.tags).map(tag => <Tag key={tag} color="violet">{tag}</Tag>)}</Space>}
          {article.summary && <p className="knowledge-reading-summary">{article.summary}</p>}
          <div ref={bodyRef} className="knowledge-prose" dangerouslySetInnerHTML={{ __html: content.html }} />
          {!shared && (
            <div className="knowledge-locked">
              <span className="knowledge-locked-mark" aria-hidden="true">🔒</span>
              <h2>{article.lockReason || '帖主未开启文章分享'}</h2>
              <p>这篇笔记只放出了开头部分。需要看全文的话，请联系帖主开启文章分享。</p>
            </div>
          )}
        </article>
        {shared && content.headings.length > 0 && <aside className="knowledge-toc" aria-label="文章目录">
          <p className="knowledge-eyebrow">文章目录</p>
          <nav>{content.headings.map(h => <button type="button" key={h.id} className={activeHeading === h.id ? 'is-active' : ''} style={{ paddingLeft: 12 + Math.min(h.level - 1, 3) * 12 }} onClick={() => goTo(h.id)}>{h.title}</button>)}</nav>
          <span className="knowledge-toc-note">约 {content.minutes} 分钟，读完这一篇</span>
        </aside>}
      </div>
    </div>
  )
}
