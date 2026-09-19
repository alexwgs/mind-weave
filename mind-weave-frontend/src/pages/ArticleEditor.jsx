import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Divider, Input, Select, Space, Switch, Tabs, Tag, TagInput, TextArea,
  Toast, TreeSelect, Typography, Upload, Banner, Modal, Spin
} from '@douyinfe/semi-ui'
import { IconArrowLeft, IconDelete, IconFile, IconTickCircle, IconUpload, IconVideo } from '@douyinfe/semi-icons'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import '@wangeditor/editor/dist/css/style.css'
import { toolApi } from '../api'
import { renderMarkdown } from '../utils/markdown'
import { useAuth } from '../auth'
import { ARTICLE_TEMPLATES, draftKey, readDraft, htmlToMarkdown, downloadMarkdown, prepareReadingHtml, readingStats } from '../utils/knowledge'
import '../knowledge.css'

const { Title, Text } = Typography
const { TabPane } = Tabs

export default function ArticleEditor() {
  const params = useParams()
  const { pathname } = useLocation()
  // /article/new 命中的是不带参数的字面量路由，useParams() 只会给空对象，
  // 所以 id 必须回退到路径本身来取，否则会被判成非法 id 而反复重定向回本页。
  const id = params.id ?? (/^\/article\/new\/?$/.test(pathname) ? 'new' : undefined)
  return <ArticleEditorContent key={id} id={id} />
}

function ArticleEditorContent({ id: idProp }) {
  const params = useParams()
  const id = idProp ?? params.id
  const navigate = useNavigate()
  const auth = useAuth()
  const [cats, setCats] = useState([])
  const [form, setForm] = useState({
    title: '', summary: '', categoryId: null, tags: '', status: 'DRAFT',
    coverAttachId: null, isTop: 0, isFeatured: 0, isCarousel: 0, commentEnabled: 1
  })
  const [md, setMd] = useState('')
  const [html, setHtml] = useState('')
  const [tab, setTab] = useState('rich')
  const [attachments, setAttachments] = useState([])
  const [coverFileList, setCoverFileList] = useState([])
  const [editor, setEditor] = useState(null)
  const htmlRef = useRef('')
  const fromEditorRef = useRef(false)
  const pushedRef = useRef('')
  const mdChangedRef = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [localSavedAt, setLocalSavedAt] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [recovery, setRecovery] = useState(null)
  const [template, setTemplate] = useState(null)
  const sourceRef = useRef('rich')
  const draftStateRef = useRef(null)
  const skipBackupRef = useRef(false)
  const dirtyRef = useRef(false)
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const isNew = id === 'new'
  const invalidId = !isNew && !/^\d+$/.test(id || '')
  const articleId = isNew || invalidId ? null : Number(id)
  const key = draftKey(auth.user, articleId)
  const canSave = auth.can(isNew ? 'article.create' : 'article.edit')
  const markDirty = () => { dirtyRef.current = true; skipBackupRef.current = false; setDirty(true) }
  const changeForm = (updater) => { setForm(updater); markDirty() }

  const currentContent = () => sourceRef.current === 'md'
    ? { contentMd: md, contentHtml: renderMarkdown(md) }
    : { contentMd: htmlToMarkdown(htmlRef.current), contentHtml: htmlRef.current }
  draftStateRef.current = { version: 1, form, md, html, source: sourceRef.current, updatedAt: new Date().toISOString() }
  const persistDraft = () => {
    if (!key || !dirtyRef.current || skipBackupRef.current) return
    try {
      localStorage.setItem(key, JSON.stringify({ ...draftStateRef.current, updatedAt: new Date().toISOString() }))
      setLocalSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false })); setStorageError(false)
    } catch { setStorageError(true) }
  }

  const updateHtml = (h) => {
    htmlRef.current = h
    setHtml(h)
  }

  useEffect(() => {
    let active = true
    if (invalidId) { navigate('/article/new', { replace: true }); return }
    toolApi.categories().then(setCats).catch(() => Toast.error('分类加载失败，请检查登录状态'))
    const restoreCandidate = readDraft(localStorage, key)
    setRecovery(restoreCandidate)
    if (!isNew && !invalidId) {
      toolApi.article(articleId).then((a) => {
        if (!active) return
        setForm({
          title: a.title, summary: a.summary || '', categoryId: a.categoryId, tags: a.tags || '', status: a.status,
          coverAttachId: a.coverAttachId || null, isTop: a.isTop || 0, isFeatured: a.isFeatured || 0,
          isCarousel: a.isCarousel || 0, commentEnabled: a.commentEnabled === 0 ? 0 : 1
        })
        setMd(a.contentMd || '')
        updateHtml(a.contentHtml || renderMarkdown(a.contentMd))
        if (a.coverAttachId) {
          setCoverFileList([{ uid: '-1', name: '封面', status: 'success', url: toolApi.attachmentUrl(a.coverAttachId, 'content') }])
        }
        loadAttachments()
        setLoaded(true)
      }).catch(() => { if (active) { setLoadError(true); setLoaded(true) } })
    } else setLoaded(true)
    return () => { active = false }
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!loaded || !dirty || recovery) return
    const timer = setTimeout(persistDraft, 800)
    return () => clearTimeout(timer)
  }, [loaded, dirty, form, md, html, recovery]) // eslint-disable-line

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirtyRef.current) return
      persistDraft(); event.preventDefault(); event.returnValue = ''
    }
    const beforeLink = (event) => {
      const link = event.target.closest?.('a[href]')
      if (!dirtyRef.current || !link || link.target === '_blank' || link.hasAttribute('download') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
      const destination = new URL(link.href, window.location.href)
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return
      persistDraft()
      if (!window.confirm('文章有尚未保存到知识库的修改，确定离开编辑页？')) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', beforeLink, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', beforeLink, true)
      if (key && dirtyRef.current && !skipBackupRef.current) {
        try { localStorage.setItem(key, JSON.stringify({ ...draftStateRef.current, updatedAt: new Date().toISOString() })) } catch { /* Browser storage may be unavailable. */ }
      }
    }
  }, [key]) // eslint-disable-line

  // 外部内容（加载/切换）变化时推送到编辑器；用户输入不重复推送
  useEffect(() => {
    if (editor && !fromEditorRef.current && html !== pushedRef.current) {
      editor.setHtml(html)
      pushedRef.current = html
    }
    fromEditorRef.current = false
  }, [html, editor])

  useEffect(() => () => {
    if (editor) editor.destroy()
  }, [editor])

  const treeData = useMemo(() => {
    const map = {}
    cats.forEach((c) => {
      map[c.id] = { label: c.name, value: String(c.id), key: String(c.id), children: [] }
    })
    const roots = []
    cats.forEach((c) => {
      if (c.parentId && map[c.parentId]) map[c.parentId].children.push(map[c.id])
      else roots.push(map[c.id])
    })
    return roots
  }, [cats])

  const tagsArr = useMemo(() => (form.tags ? form.tags.split(',').filter(Boolean) : []), [form.tags])

  const loadAttachments = async () => {
    if (!articleId) return
    setAttachments(await toolApi.listAttachments({ bizType: 'ARTICLE', bizId: articleId }))
  }

  const menuConf = useMemo(() => ({
    uploadImage: {
      async customUpload(file, insertFn) {
        if (!articleId) {
          Toast.warning('请先保存文章，再上传图片')
          return
        }
        const a = await toolApi.uploadAttachment(file, 'ARTICLE', articleId)
        insertFn(toolApi.attachmentUrl(a.id, 'content'), file.name, file.name)
        loadAttachments()
      }
    },
    uploadVideo: {
      async customUpload(file, insertFn) {
        if (!articleId) {
          Toast.warning('请先保存文章，再上传视频')
          return
        }
        if (!/video\//.test(file.type)) {
          Toast.warning('请上传视频文件')
          return
        }
        const a = await toolApi.uploadAttachment(file, 'ARTICLE', articleId)
        insertFn(toolApi.attachmentUrl(a.id, 'content'))
        loadAttachments()
      }
    }
  }), [articleId]) // eslint-disable-line

  const editorConfig = useMemo(() => ({
    placeholder: '请输入内容…，可粘贴截图、上传图片/视频',
    MENU_CONF: menuConf
  }), [menuConf])

  const toolbarConfig = useMemo(() => ({
    excludeKeys: ['insertVideo', 'fullScreen']
  }), [])

  const onRichChange = (ed) => {
    if (sourceRef.current !== 'rich') return
    if (loaded && ed.isFocused() && ed.getHtml() !== htmlRef.current) markDirty()
    fromEditorRef.current = true
    updateHtml(ed.getHtml())
  }

  const onMdChange = (v) => {
    sourceRef.current = 'md'
    setMd(v)
    mdChangedRef.current = true
    markDirty()
  }

  const switchTab = (key) => {
    if (key === 'md' && sourceRef.current === 'rich') {
      setMd(htmlToMarkdown(htmlRef.current))
      sourceRef.current = 'md'
    }
    if (key === 'rich' && sourceRef.current === 'md') {
      updateHtml(renderMarkdown(md))
      sourceRef.current = 'rich'
      mdChangedRef.current = false
    }
    setTab(key)
  }

  const coverUpload = async ({ fileInstance, onSuccess, onError }) => {
    if (!articleId) {
      Toast.warning('请先保存文章，再上传封面')
      onError && onError(new Error('请先保存文章'))
      return
    }
    try {
      const a = await toolApi.uploadAttachment(fileInstance, 'ARTICLE', articleId)
      changeForm((f) => ({ ...f, coverAttachId: a.id }))
      onSuccess && onSuccess({ id: a.id })
      loadAttachments()
      Toast.success('封面已上传，保存文章后生效')
    } catch (e) {
      onError && onError(e)
    }
  }

  const onUpload = async (e, kind) => {
    if (!articleId) {
      Toast.warning('请先保存文章，再上传附件')
      return
    }
    const file = e.target.files[0]
    if (!file) return
    try {
      const a = await toolApi.uploadAttachment(file, 'ARTICLE', articleId)
      Toast.success(kind === 'file' ? `已插入附件：${file.name}` : '上传成功')
      if (kind === 'video') {
        setMd((m) => m + `\n@video(attachment:${a.id})\n`)
      } else if (kind === 'file') {
        // 带 size 属性 => 渲染成下载链接而不是图片
        setMd((m) => m + `\n[${file.name}](attachment:${a.id} "size=${file.size}")\n`)
      } else {
        setMd((m) => m + `\n![${file.name}](attachment:${a.id})\n`)
      }
      sourceRef.current = 'md'
      mdChangedRef.current = true
      markDirty()
      loadAttachments()
    } finally {
      e.target.value = ''
    }
  }

  const save = async (statusOverride) => {
    if (saving || !canSave) return
    if (!form.title.trim()) {
      Toast.warning('标题必填')
      return
    }
    const { contentHtml: finalHtml, contentMd: finalMd } = currentContent()
    const payload = {
      ...form,
      title: form.title.trim(),
      status: statusOverride || form.status,
      contentMd: finalMd,
      contentHtml: finalHtml,
      coverAttachId: form.coverAttachId,
      isTop: form.isTop ? 1 : 0,
      isFeatured: form.isFeatured ? 1 : 0,
      isCarousel: form.isCarousel ? 1 : 0,
      commentEnabled: form.commentEnabled ? 1 : 0
    }
    setSaving(true)
    try {
      const saved = articleId ? await toolApi.updateArticle(articleId, payload) : await toolApi.createArticle(payload)
      skipBackupRef.current = true; dirtyRef.current = false; setDirty(false); setRecovery(null)
      try { if (key) localStorage.removeItem(key) } catch { /* Saving to the server already succeeded. */ }
      setForm(f => ({ ...f, status: payload.status })); setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      Toast.success(payload.status === 'PUBLISHED' ? '文章已保存并发布' : '草稿已保存')
      if (isNew) navigate(`/article/${saved.id}`, { replace: true })
    } catch { persistDraft() } finally { setSaving(false) }
  }

  const useTemplate = (item) => {
    const apply = () => { sourceRef.current = 'md'; setMd(item.content); mdChangedRef.current = true; setTab('md'); setTemplate(null); markDirty() }
    if (currentContent().contentMd.trim()) Modal.confirm({ title: '用模板替换当前正文？', content: '标题和文章设置会保留。当前正文将被模板替换。', onOk: apply })
    else apply()
  }
  const stats = readingStats(sourceRef.current === 'md' ? md : html)
  const preview = prepareReadingHtml(sourceRef.current === 'md' ? renderMarkdown(md) : html).html
  if (!loaded) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (loadError) return <Banner type="danger" description="文章加载失败，请返回知识库后重试。" />

  return (
    <div className="knowledge-editor">
      {recovery && <Banner type="info" closeIcon={null} description={<div className="knowledge-recovery"><div><strong>发现未保存的本地草稿</strong><p>{String(recovery.updatedAt || '').replace('T', ' ').slice(0, 16)} · {recovery.form.title || '未命名文章'}。恢复后仍需点击保存，才会更新知识库。</p></div><Space wrap><Button onClick={() => {
        setForm({ commentEnabled: 1, ...recovery.form }); setMd(recovery.md); updateHtml(recovery.html); sourceRef.current = recovery.source === 'md' ? 'md' : 'rich'; setTab(sourceRef.current); mdChangedRef.current = sourceRef.current === 'md';
        setCoverFileList(recovery.form.coverAttachId ? [{ uid: '-1', name: '封面', status: 'success', url: toolApi.attachmentUrl(recovery.form.coverAttachId, 'content') }] : []); setRecovery(null); markDirty()
      }}>恢复草稿</Button><Button theme="borderless" onClick={() => { try { localStorage.removeItem(key) } catch { /* Ignore unavailable storage. */ } setRecovery(null) }}>舍弃本地草稿</Button></Space></div>} />}
      {storageError && <Banner type="warning" description="本地草稿暂时无法保存，请及时保存到知识库或导出 Markdown。" />}
      <div className="knowledge-editor-status"><span className="knowledge-eyebrow">{isNew ? '写一篇新笔记' : '继续打磨你的笔记'}</span><span role="status">{saving ? '正在保存…' : dirty ? `有未保存的修改${localSavedAt ? ` · 本地草稿 ${localSavedAt}` : ''}` : savedAt ? `已保存于 ${savedAt}` : '内容已加载'}</span></div>
      {/* 顶栏 */}
      <Card bodyStyle={{ padding: '14px 20px' }}>
        <Space style={{ width: '100%', flexWrap: 'wrap' }}>
          <Button icon={<IconArrowLeft />} onClick={() => { if (!dirtyRef.current || window.confirm('文章有尚未保存到知识库的修改，确定返回？')) { persistDraft(); navigate('/articles') } }}>返回</Button>
          <Input
            size="large"
            placeholder="文章标题"
            value={form.title}
            onChange={(v) => changeForm((f) => ({ ...f, title: v }))}
            style={{ flex: 1, minWidth: 160, fontWeight: 600 }}
          />
          <Select value={form.status} onChange={(v) => changeForm((f) => ({ ...f, status: v }))} style={{ width: 100 }}
            optionList={[{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '发布' }]} />
          <Button theme="solid" type="primary" disabled={!canSave || !!recovery} loading={saving} icon={<IconTickCircle />} onClick={() => save()}>保存</Button>
          <Button disabled={!canSave || !!recovery || saving} onClick={() => save('PUBLISHED')}>保存并发布</Button>
        </Space>
      </Card>

      {/* 主体：编辑器 + 文章设置 */}
      <div className="knowledge-editor-layout" style={{ pointerEvents: saving ? 'none' : undefined }}>
        <div className="knowledge-editor-main">
          <div className="knowledge-editor-utilities"><Space wrap><Select placeholder="从模板开始" value={template} onChange={value => useTemplate(ARTICLE_TEMPLATES.find(item => item.id === value))} style={{ width: 150 }} optionList={ARTICLE_TEMPLATES.map(item => ({ value: item.id, label: item.label }))} /><Button theme="borderless" onClick={() => downloadMarkdown({ title: form.title, ...currentContent() })}>导出 Markdown</Button></Space><span>{stats.count.toLocaleString()} 字 · 约 {stats.minutes} 分钟</span></div>
          <Tabs activeKey={tab} onChange={switchTab} type="line">
            <TabPane tab="富文本编辑" itemKey="rich">
              <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, overflow: 'hidden' }}>
                <Toolbar editor={editor} defaultConfig={toolbarConfig} style={{ borderBottom: '1px solid var(--semi-color-border)' }} />
                <Editor
                  defaultConfig={editorConfig}
                  onCreated={(e) => { setEditor(e); e.setHtml(htmlRef.current || '<p><br/></p>') }}
                  onChange={onRichChange}
                  mode="default"
                  style={{ height: 460, overflowY: 'hidden' }}
                />
              </div>
              {!articleId && <Text type="warning" size="small" style={{ display: 'block', marginTop: 8 }}>保存文章后可上传图片/视频/文件/封面</Text>}
            </TabPane>
            <TabPane tab="Markdown 源码" itemKey="md">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 'min(100%, 300px)' }}>
                  <Space style={{ marginBottom: 8 }}>
                    {/* 用 ref 主动 click()：把 input 设成 display:none 时，
                        浏览器不会把 label 的点击转发给文件输入框，按钮会像坏了一样没反应 */}
                    <Button size="small" icon={<IconUpload />} onClick={() => imageInputRef.current?.click()}>插入图片</Button>
                    <input ref={imageInputRef} type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => onUpload(e, 'image')} />
                    <Button size="small" icon={<IconVideo />} onClick={() => videoInputRef.current?.click()}>插入视频(MP4)</Button>
                    <input ref={videoInputRef} type="file" style={{ display: 'none' }} accept="video/*" onChange={(e) => onUpload(e, 'video')} />
                    <Button size="small" icon={<IconFile />} onClick={() => fileInputRef.current?.click()}>插入文件</Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.zip,.rar,.7z,.json,.xml"
                      onChange={(e) => onUpload(e, 'file')}
                    />
                  </Space>
                  <textarea
                    value={md}
                    onChange={(e) => onMdChange(e.target.value)}
                    placeholder="支持 Markdown：标题 #、列表 -、代码 ```、图片 ![说明](attachment:ID)、视频 @video(attachment:ID)、文件 [文件名](attachment:ID &quot;size=字节数&quot;)"
                    style={{ width: '100%', minHeight: 430, fontFamily: 'monospace', padding: 12, border: '1px solid var(--semi-color-border)', borderRadius: 8, boxSizing: 'border-box', fontSize: 14, lineHeight: 1.6, resize: 'vertical', background: 'var(--semi-color-bg-0)', color: 'var(--semi-color-text-0)' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 'min(100%, 300px)', border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: 12, minHeight: 430, fontSize: 14, overflow: 'auto', background: 'var(--semi-color-bg-0)' }}>
                  <div className="knowledge-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} />
                </div>
              </div>
            </TabPane>
            <TabPane tab="预览" itemKey="preview">
              <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', borderRadius: 8, minHeight: 460, fontSize: 14, background: 'var(--semi-color-bg-0)' }}>
                <div className="knowledge-prose" dangerouslySetInnerHTML={{ __html: preview }} />
              </div>
            </TabPane>
          </Tabs>
        </div>

        {/* 文章设置 */}
        <div className="knowledge-editor-settings">
          <Card title="文章设置" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Text strong>分类</Text>
              <TreeSelect
                style={{ width: '100%', marginTop: 6 }}
                treeData={treeData}
                value={form.categoryId != null ? String(form.categoryId) : undefined}
                showClear
                onChange={(v) => changeForm((f) => ({ ...f, categoryId: v ? Number(v) : null }))}
                placeholder="选择分类"
                filterTreeNode
                defaultExpandAll
              />
            </div>
            <div>
              <Text strong>标签</Text>
              <TagInput
                style={{ width: '100%', marginTop: 6 }}
                value={tagsArr}
                onChange={(arr) => changeForm((f) => ({ ...f, tags: arr.join(',') }))}
                placeholder="输入后回车添加标签"
              />
            </div>
            <div>
              <Text strong>摘要</Text>
              <TextArea
                style={{ width: '100%', marginTop: 6 }}
                rows={3}
                placeholder="文章摘要（选填）"
                value={form.summary}
                onChange={(v) => changeForm((f) => ({ ...f, summary: v }))}
              />
            </div>
            <Divider style={{ margin: '4px 0' }} />
            <div>
              <Text strong>封面图</Text>
              <Upload
                accept="image/*"
                limit={1}
                fileList={coverFileList}
                onChange={({ fileList }) => setCoverFileList(fileList)}
                customRequest={coverUpload}
                onRemove={() => changeForm((f) => ({ ...f, coverAttachId: null }))}
                prompt={<Text type="tertiary" size="small">建议 16:9，最多 1 张</Text>}
                style={{ marginTop: 6 }}
              >
                <Button icon={<IconUpload />}>上传封面</Button>
              </Upload>
            </div>
            <Divider style={{ margin: '4px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Space style={{ justifyContent: 'space-between' }}>
                <Text>置顶</Text>
                <Switch size="small" checked={!!form.isTop} onChange={(v) => changeForm((f) => ({ ...f, isTop: v ? 1 : 0 }))} />
              </Space>
              <Space style={{ justifyContent: 'space-between' }}>
                <Text>精华</Text>
                <Switch size="small" checked={!!form.isFeatured} onChange={(v) => changeForm((f) => ({ ...f, isFeatured: v ? 1 : 0 }))} />
              </Space>
              <Space style={{ justifyContent: 'space-between' }}>
                <Text>轮播展示</Text>
                <Switch size="small" checked={!!form.isCarousel} onChange={(v) => changeForm((f) => ({ ...f, isCarousel: v ? 1 : 0 }))} />
              </Space>
              <Space style={{ justifyContent: 'space-between' }}>
                <span><Text>开放评论</Text><Text type="tertiary" size="small" style={{ display: 'block' }}>评论审核通过后显示</Text></span>
                <Switch size="small" checked={!!form.commentEnabled} onChange={(v) => changeForm((f) => ({ ...f, commentEnabled: v ? 1 : 0 }))} />
              </Space>
            </div>
          </Card>

          <Card title="附件管理" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attachments.length === 0 ? (
              <Text type="tertiary" size="small">暂无附件（正文里的图片/视频会自动归档到这里）</Text>
            ) : (
              attachments.map((a) => (
                <Space key={a.id} style={{ justifyContent: 'space-between' }}>
                  <Tag color="blue" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.originalName}</Tag>
                  <Button size="small" theme="borderless" type="danger" icon={<IconDelete />}
                    onClick={async () => { await toolApi.deleteAttachment(a.id); loadAttachments() }} />
                </Space>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
