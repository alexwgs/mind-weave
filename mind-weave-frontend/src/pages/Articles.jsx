import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, Input, Modal, Pagination, Select, Space, Spin, Table, Tag, Toast, Popconfirm } from '@douyinfe/semi-ui'
import { IconDelete, IconEdit, IconPlus, IconSearch, IconShareStroked, IconEyeOpened, IconArticle } from '@douyinfe/semi-icons'
import { toolApi } from '../api'
import { useAuth } from '../auth'
import { splitTags } from '../utils/knowledge'
import '../knowledge.css'

function CategoryNode({ cat, depth, active, onSelect, onAdd, onRename, onDelete, canEdit }) {
  return <div>
    <div className={`knowledge-category ${active === cat.id ? 'is-active' : ''}`} style={{ marginLeft: Math.min(depth, 4) * 12 }}>
      <button type="button" className="knowledge-category-label" onClick={() => onSelect(cat.id)}><span className="knowledge-category-dot" />{cat.name}</button>
      {canEdit && <span className="knowledge-category-actions">
        <Button aria-label={`在${cat.name}下新建分类`} size="small" theme="borderless" icon={<IconPlus />} onClick={() => onAdd(cat)} />
        <Button aria-label={`编辑${cat.name}`} size="small" theme="borderless" icon={<IconEdit />} onClick={() => onRename(cat)} />
        <Popconfirm title={`删除分类「${cat.name}」？`} content="该分类下的文章会保留。含有子分类时需要先处理子分类。" onConfirm={() => onDelete(cat)}><Button aria-label={`删除${cat.name}`} size="small" theme="borderless" type="danger" icon={<IconDelete />} /></Popconfirm>
      </span>}
    </div>
    {cat.children.map(child => <CategoryNode key={child.id} cat={child} depth={depth + 1} active={active} onSelect={onSelect} onAdd={onAdd} onRename={onRename} onDelete={onDelete} canEdit={canEdit} />)}
  </div>
}

function buildTree(cats) {
  const map = new Map(cats.map(c => [c.id, { ...c, children: [] }]))
  const roots = []
  map.forEach(c => {
    if (c.parentId && c.parentId !== c.id && map.has(c.parentId)) map.get(c.parentId).children.push(c)
    else roots.push(c)
  })
  return roots
}

export default function Articles() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [cats, setCats] = useState([])
  const [filters, setFilters] = useState({ categoryId: null, status: '', keyword: '', tag: '', sort: 'updatedAt:desc', page: 1 })
  const [keyword, setKeyword] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [view, setView] = useState('cards')
  const [catModal, setCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ id: null, name: '', parentId: null })
  const [shareModal, setShareModal] = useState(false)
  const [shareRow, setShareRow] = useState(null)
  const [shareForm, setShareForm] = useState({ days: 7, password: '' })
  const [shareLink, setShareLink] = useState('')
  const [sharing, setSharing] = useState(false)
  const updateFilters = (values) => setFilters(previous => ({ ...previous, ...values, page: 1 }))
  const reload = () => setRevision(value => value + 1)
  const loadCats = () => toolApi.categories().then(setCats).catch(() => {})
  useEffect(() => { loadCats() }, [])
  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    const [sortField, sortOrder] = filters.sort.split(':')
    toolApi.articles({ page: filters.page, size: 12, categoryId: filters.categoryId || undefined, status: filters.status || undefined,
      keyword: filters.keyword || undefined, tag: filters.tag || undefined, sortField, sortOrder }).then(data => {
      if (!active) return
      if (!data.records?.length && filters.page > 1 && data.total > 0) { setFilters(f => ({ ...f, page: Math.ceil(data.total / 12) })); return }
      setRows(data.records || []); setTotal(data.total || 0)
    }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, revision])

  const tree = useMemo(() => buildTree(cats), [cats])
  const pageTags = [...new Set(rows.flatMap(row => splitTags(row.tags)))].slice(0, 16)
  const selectedCat = cats.find(c => c.id === filters.categoryId)
  const hasFilters = filters.keyword || filters.tag || filters.status || filters.categoryId
  const clearFilters = () => { setKeyword(''); setTagInput(''); updateFilters({ keyword: '', tag: '', categoryId: null, status: '' }) }
  const openShare = (row) => {
    setShareRow(row); setShareForm({ days: 7, password: '' }); setShareLink(row.shareToken ? `${window.location.origin}/share/${row.shareToken}` : ''); setShareModal(true)
  }
  const deleteArticle = async (row) => { await toolApi.deleteArticle(row.id); Toast.success('文章已删除'); reload() }
  const actions = (row) => <Space spacing={4}>
    <Button title="阅读文章" aria-label={`阅读${row.title}`} size="small" theme="borderless" icon={<IconEyeOpened />} onClick={() => navigate(`/article-view/${row.id}`)} />
    {auth.can('article.edit') && <><Button title="编辑文章" aria-label={`编辑${row.title}`} size="small" theme="borderless" icon={<IconEdit />} onClick={() => navigate(`/article/${row.id}`)} /><Button title="分享文章" aria-label={`分享${row.title}`} size="small" theme="borderless" icon={<IconShareStroked />} onClick={() => openShare(row)} /></>}
    {auth.can('article.delete') && <Popconfirm title={`删除「${row.title}」？`} content="删除后无法恢复。" onConfirm={() => deleteArticle(row)}><Button title="删除文章" aria-label={`删除${row.title}`} size="small" theme="borderless" type="danger" icon={<IconDelete />} /></Popconfirm>}
  </Space>
  const flags = (row) => <Space spacing={4} wrap>
    <Tag size="small" color={row.status === 'PUBLISHED' ? 'green' : 'grey'}>{row.status === 'PUBLISHED' ? '已发布' : '草稿'}</Tag>
    {!!row.isTop && <Tag size="small" color="violet">置顶</Tag>}{!!row.isFeatured && <Tag size="small" color="orange">精华</Tag>}{!!row.isCarousel && <Tag size="small" color="blue">轮播</Tag>}
  </Space>
  const columns = [
    { title: '文章', dataIndex: 'title', render: (title, row) => <div><button className="knowledge-text-link" onClick={() => navigate(`/article-view/${row.id}`)}>{title}</button><div className="knowledge-row-summary">{row.summary || '暂无摘要'}</div></div> },
    { title: '分类 / 标签', width: 200, render: (_, row) => <div><span className="knowledge-muted">{row.categoryPath || '未分类'}</span><div className="knowledge-tag-links">{splitTags(row.tags).slice(0, 3).map(tag => <button key={tag} onClick={() => { setTagInput(tag); updateFilters({ tag }) }}>#{tag}</button>)}</div></div> },
    { title: '状态', width: 180, render: (_, row) => flags(row) },
    { title: '更新时间', dataIndex: 'updatedAt', width: 115, render: value => String(value || '').slice(0, 10) },
    { title: '操作', width: 150, render: (_, row) => actions(row) }
  ]
  const saveCat = async () => {
    if (!catForm.name.trim()) { Toast.warning('请输入分类名称'); return }
    const payload = { ...catForm, name: catForm.name.trim() }
    if (catForm.id) await toolApi.updateCategory(catForm.id, payload)
    else await toolApi.createCategory(payload)
    setCatModal(false); loadCats(); reload()
  }
  const excludedParents = new Set(catForm.id ? [catForm.id] : [])
  let previousSize = -1
  while (previousSize !== excludedParents.size) { previousSize = excludedParents.size; cats.forEach(c => { if (excludedParents.has(c.parentId)) excludedParents.add(c.id) }) }

  return <div className="knowledge-workspace">
    <header className="knowledge-heading">
      <div><span className="knowledge-eyebrow">我的知识花园</span><h1>每个想法，都有位置<span className="knowledge-heading-spark" aria-hidden="true">✳</span></h1><p>把零散灵感整理成笔记，让经验慢慢长成自己的知识库。</p></div>
      {auth.can('article.create') && <Button size="large" theme="solid" type="primary" icon={<IconPlus />} onClick={() => navigate('/article/new')}>写一篇笔记</Button>}
    </header>
    <div className="knowledge-library">
      <aside className="knowledge-sidebar">
        <div className="knowledge-sidebar-title"><h2>我的分类</h2>{auth.can('article.edit') && <Button title="新建分类" aria-label="新建分类" size="small" theme="borderless" icon={<IconPlus />} onClick={() => { setCatForm({ id: null, name: '', parentId: null }); setCatModal(true) }} />}</div>
        <button className={`knowledge-all-category ${filters.categoryId === null ? 'is-active' : ''}`} onClick={() => updateFilters({ categoryId: null })}><IconArticle />全部笔记</button>
        {tree.map(cat => <CategoryNode key={cat.id} cat={cat} depth={0} active={filters.categoryId} onSelect={categoryId => updateFilters({ categoryId })} canEdit={auth.can('article.edit')}
          onAdd={parent => { setCatForm({ id: null, name: '', parentId: parent.id }); setCatModal(true) }} onRename={c => { setCatForm({ id: c.id, name: c.name, parentId: c.parentId }); setCatModal(true) }}
          onDelete={async c => { await toolApi.deleteCategory(c.id); if (filters.categoryId === c.id) updateFilters({ categoryId: null }); loadCats(); reload() }} />)}
        {cats.length === 0 && <p className="knowledge-sidebar-note">按学习、工作或生活建立分类，方便下次找到它。</p>}
        <div className="knowledge-sidebar-tags"><h2>标签筛选</h2><Input aria-label="筛选标签" size="small" placeholder="输入标签后按回车" value={tagInput} onChange={setTagInput} onEnterPress={() => updateFilters({ tag: tagInput.trim() })} showClear onClear={() => updateFilters({ tag: '' })} />
          <div className="knowledge-tag-links">{pageTags.map(tag => <button className={filters.tag === tag ? 'is-active' : ''} key={tag} onClick={() => { setTagInput(tag); updateFilters({ tag }) }}>#{tag}</button>)}</div>
          <p className="knowledge-sidebar-note">点击本页标签，查找整个知识库中的相关笔记。</p>
        </div>
        <div className="knowledge-shelf-note"><span aria-hidden="true">✦</span><p>好记性，也需要一个<br />随时翻阅的地方。</p></div>
      </aside>
      <section className="knowledge-library-main">
        <div className="knowledge-library-title"><div><h2>{selectedCat?.path || selectedCat?.name || '全部笔记'}</h2><span className="knowledge-muted">{loading ? '正在整理笔记…' : `${total} 篇${hasFilters ? '符合筛选条件的' : ''}笔记`}</span></div><div className="knowledge-view-switch" aria-label="显示方式"><button aria-pressed={view === 'cards'} onClick={() => setView('cards')}>卡片</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}>列表</button></div></div>
        <div className="knowledge-filters">
          <Input aria-label="搜索文章标题或摘要" prefix={<IconSearch />} placeholder="搜索标题或摘要" value={keyword} onChange={setKeyword} onEnterPress={() => updateFilters({ keyword: keyword.trim() })} showClear onClear={() => updateFilters({ keyword: '' })} className="knowledge-search" />
          <Button onClick={() => updateFilters({ keyword: keyword.trim(), tag: tagInput.trim() })}>搜索</Button>
          <Select aria-label="文章状态" value={filters.status} onChange={status => updateFilters({ status })} style={{ width: 112 }} optionList={[{ value: '', label: '全部状态' }, { value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }]} />
          <Select aria-label="文章排序" value={filters.sort} onChange={sort => updateFilters({ sort })} style={{ width: 132 }} optionList={[{ value: 'updatedAt:desc', label: '最近更新' }, { value: 'createdAt:desc', label: '最近创建' }, { value: 'viewCount:desc', label: '浏览最多' }, { value: 'viewCount:asc', label: '浏览最少' }]} />
        </div>
        {hasFilters && <div className="knowledge-active-filters"><span>{filters.keyword && `搜索：${filters.keyword}　`}{filters.tag && `标签包含：${filters.tag}　`}{filters.status && (filters.status === 'DRAFT' ? '草稿' : '已发布')}</span><Button size="small" theme="borderless" onClick={clearFilters}>清除筛选</Button></div>}
        {loading ? <div className="knowledge-loading"><Spin /></div> : error ? <Empty description="笔记加载失败，请重试" style={{ padding: 60 }}><Button onClick={reload}>重新加载</Button></Empty> : rows.length === 0 ? <Empty description={hasFilters ? '没有找到符合条件的笔记，试试其他关键词或分类。' : '从第一篇笔记开始，收集值得留下的想法。'} style={{ padding: '70px 20px' }}>{hasFilters ? <Button onClick={clearFilters}>查看全部笔记</Button> : auth.can('article.create') && <Button onClick={() => navigate('/article/new')}>写第一篇笔记</Button>}</Empty> : view === 'list' ? <div className="knowledge-table"><Table columns={columns} dataSource={rows} rowKey="id" pagination={false} /></div> : <div className="knowledge-card-grid">
          {rows.map((row, index) => <article className={`knowledge-card knowledge-card-tone-${index % 3}`} key={row.id}>
            <div className="knowledge-card-top"><span className="knowledge-card-category">{row.categoryPath || '未分类'}</span>{row.isTop ? <span className="knowledge-pin">置顶</span> : <IconArticle />}</div>
            <button className="knowledge-card-title" onClick={() => navigate(`/article-view/${row.id}`)}>{row.title}</button>
            <p className="knowledge-card-summary">{row.summary || '还没有摘要，打开笔记读一读。'}</p>
            <div className="knowledge-tag-links">{splitTags(row.tags).slice(0, 4).map(tag => <button key={tag} onClick={() => { setTagInput(tag); updateFilters({ tag }) }}>#{tag}</button>)}</div>
            <div className="knowledge-card-status">{flags(row)}</div>
            <div className="knowledge-card-footer"><span>{String(row.updatedAt || '').slice(0, 10)} · {row.viewCount || 0} 阅</span>{actions(row)}</div>
          </article>)}
        </div>}
        {!loading && !error && total > 12 && <div className="knowledge-pagination"><Pagination currentPage={filters.page} pageSize={12} total={total} onPageChange={page => setFilters(f => ({ ...f, page }))} /></div>}
      </section>
    </div>
    <Modal title={catForm.id ? '编辑分类' : '新建分类'} visible={catModal} onCancel={() => setCatModal(false)} onOk={saveCat}>
      <Space vertical style={{ width: '100%' }}><Select placeholder="上级分类（可选）" showClear value={catForm.parentId} onChange={value => setCatForm({ ...catForm, parentId: value || null })} style={{ width: '100%' }} optionList={cats.filter(c => !excludedParents.has(c.id)).map(c => ({ value: c.id, label: c.path || c.name }))} /><Input aria-label="分类名称" placeholder="分类名称" value={catForm.name} onChange={name => setCatForm({ ...catForm, name })} /></Space>
    </Modal>
    <Modal title={`分享${shareRow?.title ? `「${shareRow.title}」` : '文章'}`} visible={shareModal} style={{ maxWidth: 'calc(100vw - 32px)' }} width={520} footer={null} onCancel={() => setShareModal(false)}>
      {!shareLink ? <div className="knowledge-share-form"><p>持有链接的人可访问这篇文章。你可以设置有效期和访问密码。</p><Input type="number" prefix="有效期（天）" value={shareForm.days} onChange={days => setShareForm({ ...shareForm, days })} /><Input placeholder="访问密码（可选）" value={shareForm.password} onChange={password => setShareForm({ ...shareForm, password })} /><Button theme="solid" type="primary" loading={sharing} onClick={async () => {
        const days = Number(shareForm.days)
        if (!Number.isInteger(days) || days < 1) { Toast.warning('有效期请输入大于 0 的整数'); return }
        setSharing(true)
        try { const article = await toolApi.shareArticle(shareRow.id, { days, password: shareForm.password }); setShareLink(`${window.location.origin}/share/${article.shareToken}`); reload() } finally { setSharing(false) }
      }}>生成分享链接</Button></div> : <div className="knowledge-share-form"><Input value={shareLink} readOnly /><Space wrap><Button onClick={async () => { try { await navigator.clipboard.writeText(shareLink); Toast.success('链接已复制') } catch { Toast.warning('复制失败，请选中链接手动复制') } }}>复制链接</Button><Button type="danger" theme="borderless" onClick={async () => { await toolApi.disableShare(shareRow.id); setShareLink(''); Toast.success('已取消分享'); reload() }}>取消分享</Button></Space></div>}
    </Modal>
  </div>
}
