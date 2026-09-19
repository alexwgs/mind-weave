import { useEffect, useMemo, useState } from 'react'
import {
  Button, Empty, Input, Modal, Select, SideSheet, Space, Spin, Switch, Table, Tag, TextArea, Toast, Tooltip, Typography
} from '@douyinfe/semi-ui'
import {
  IconActivity, IconCode, IconCopy, IconDownload, IconPlay, IconRefresh, IconSearch, IconServer
} from '@douyinfe/semi-icons'
import { apiManagerApi } from '../api'
import '../api-manager.css'

const { Text, Title } = Typography
const METHOD_COLORS = { GET: 'green', POST: 'blue', PUT: 'orange', PATCH: 'amber', DELETE: 'red' }
const LOCATION_LABELS = { path: '路径', query: '查询', file: '文件' }

const sampleValue = (field) => {
  const type = String(field.type || '')
  if (/Boolean/i.test(type)) return false
  if (/Integer|Long|Double|Float|Number/i.test(type)) return 0
  if (/List|Set|\[\]/i.test(type)) return []
  if (/Map/i.test(type)) return {}
  if (/Time|Date/i.test(type)) return '2026-09-18T09:00:00'
  if (/done/i.test(field.name)) return 0
  return ''
}

const pretty = (value) => {
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

export default function ApiManager() {
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [method, setMethod] = useState('ALL')
  const [module, setModule] = useState('ALL')
  const [stateFilter, setStateFilter] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [runner, setRunner] = useState(null)
  const [toggleId, setToggleId] = useState(null)
  const [pathValues, setPathValues] = useState({})
  const [queryValues, setQueryValues] = useState({})
  const [bodyText, setBodyText] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const load = async () => {
    setLoading(true)
    try { setCatalog(await apiManagerApi.catalog()) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const items = catalog?.items || []
  const filtered = useMemo(() => {
    const word = keyword.trim().toLowerCase()
    return items.filter((item) => {
      if (method !== 'ALL' && item.method !== method) return false
      if (module !== 'ALL' && item.module !== module) return false
      if (stateFilter === 'ENABLED' && !item.enabled) return false
      if (stateFilter === 'DISABLED' && item.enabled) return false
      if (stateFilter === 'PUBLIC' && !item.publicApi) return false
      return !word || `${item.name} ${item.path} ${item.description} ${item.source}`.toLowerCase().includes(word)
    })
  }, [items, keyword, method, module, stateFilter])

  const applyToggle = async (item, enabled) => {
    setToggleId(item.id)
    try {
      await apiManagerApi.toggle(item.method, item.path, enabled)
      setCatalog((current) => {
        const nextItems = current.items.map((row) => row.id === item.id ? { ...row, enabled } : row)
        return { ...current, items: nextItems, disabledCount: nextItems.filter((row) => !row.enabled).length }
      })
      if (selected?.id === item.id) setSelected((current) => ({ ...current, enabled }))
      Toast.success(enabled ? 'API 已恢复' : 'API 已停用')
    } finally { setToggleId(null) }
  }

  const changeEnabled = (item, enabled) => {
    if (item.protectedEndpoint) return
    if (enabled) return applyToggle(item, true)
    Modal.confirm({
      title: '停用这个 API？',
      content: <span>停用后，所有客户端请求 <code>{item.method} {item.path}</code> 都会收到 503。可随时在这里恢复。</span>,
      okText: '确认停用',
      okType: 'danger',
      onOk: () => applyToggle(item, false)
    })
  }

  const openRunner = (item) => {
    const params = item.parameters || []
    setRunner(item)
    setPathValues(Object.fromEntries(params.filter((p) => p.location === 'path').map((p) => [p.name, ''])))
    setQueryValues(Object.fromEntries(params.filter((p) => p.location === 'query').map((p) => [p.name, p.defaultValue || ''])))
    const fields = item.requestBody?.fields || []
    setBodyText(item.requestBody ? pretty(Object.fromEntries(fields.map((field) => [field.name, sampleValue(field)]))) : '')
    setResult(null)
  }

  const resolvePath = () => {
    let path = runner.path
    for (const parameter of (runner.parameters || []).filter((p) => p.location === 'path')) {
      const value = pathValues[parameter.name]
      if (parameter.required && !String(value || '').trim()) throw new Error(`请填写路径参数 ${parameter.name}`)
      path = path.replace(`{${parameter.name}}`, encodeURIComponent(value))
    }
    if (/\{[^}]+}/.test(path)) throw new Error('路径中仍有未填写的参数')
    return path
  }

  const performRun = async () => {
    setRunning(true)
    setResult(null)
    try {
      const body = runner.requestBody && bodyText.trim() ? JSON.parse(bodyText) : undefined
      const response = await apiManagerApi.execute({ method: runner.method, path: resolvePath(), query: queryValues, body })
      setResult(response)
      Toast[response.ok ? 'success' : 'error'](`请求完成：HTTP ${response.status} · ${response.duration}ms`)
    } catch (error) {
      const message = error instanceof SyntaxError ? '请求体不是有效的 JSON' : error.message
      Toast.error(message)
      setResult({ ok: false, status: 'CLIENT', duration: 0, payload: { message } })
    } finally { setRunning(false) }
  }

  const run = () => {
    if (!runner.enabled) return Toast.warning('该 API 已停用，请先恢复')
    if ((runner.parameters || []).some((p) => p.location === 'file')) return Toast.warning('文件接口请使用下方 cURL 在终端调试')
    if (runner.risk === 'READ') return performRun()
    Modal.confirm({
      title: runner.risk === 'HIGH' ? '确认执行删除请求？' : '确认执行写入请求？',
      content: '在线调试会真实调用当前环境并可能修改数据，请确认参数无误。',
      okText: '执行请求',
      okType: runner.risk === 'HIGH' ? 'danger' : 'primary',
      onOk: performRun
    })
  }

  const curl = (item = runner || selected) => {
    if (!item) return ''
    const parts = [`curl -X ${item.method} '${window.location.origin}${item.path}'`, `  -H 'Authorization: Bearer <JWT_TOKEN>'`]
    if (item.requestBody) parts.push("  -H 'Content-Type: application/json'", `  -d '${bodyText || '{}'}'`)
    return parts.join(' \\\n')
  }

  const copy = async (text, message = '已复制') => {
    await navigator.clipboard.writeText(text)
    Toast.success(message)
  }

  const exportCatalog = () => {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mindweave-api-catalog-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const columns = [
    {
      title: '接口', dataIndex: 'name', width: 430,
      render: (_, item) => <button className="api-name-cell" onClick={() => setSelected(item)}>
        <span><Tag color={METHOD_COLORS[item.method]} size="small">{item.method}</Tag><strong>{item.name}</strong></span>
        <code>{item.path}</code>
      </button>
    },
    { title: '模块', dataIndex: 'module', width: 130, render: (value) => <span className="api-module">{value}</span> },
    {
      title: '访问控制', width: 170,
      render: (_, item) => <div className="api-access"><span>{item.publicApi ? '公开接口' : '需要登录'}</span><small>{item.permission}</small></div>
    },
    {
      title: '状态', width: 110,
      render: (_, item) => item.protectedEndpoint
        ? <Tooltip content="核心保护接口，不能停用"><Tag color="violet">保护中</Tag></Tooltip>
        : <Switch aria-label={`${item.enabled ? '停用' : '启用'} ${item.method} ${item.path}`} size="small" checked={item.enabled} loading={toggleId === item.id} onChange={(value) => changeEnabled(item, value)} />
    },
    {
      title: '', width: 138, fixed: 'right',
      render: (_, item) => <Space spacing={6}>
        <Button size="small" theme="borderless" onClick={() => setSelected(item)}>文档</Button>
        <Button size="small" icon={<IconPlay />} disabled={!item.enabled} onClick={() => openRunner(item)}>调试</Button>
      </Space>
    }
  ]

  return <div className="api-manager-page">
    <section className="api-overview">
      <div className="api-overview-copy"><span className="api-kicker"><IconActivity /> LIVE CATALOG</span><h2>系统 API 控制台</h2><p>目录由后端运行时自动生成，新接口上线后会自动出现在这里。</p></div>
      <div className="api-metrics">
        <div><strong>{catalog?.total || 0}</strong><span>接口总数</span></div>
        <div><strong>{catalog?.moduleCount || 0}</strong><span>业务模块</span></div>
        <div><strong>{catalog?.publicCount || 0}</strong><span>公开接口</span></div>
        <div className={catalog?.disabledCount ? 'is-warning' : ''}><strong>{catalog?.disabledCount || 0}</strong><span>已停用</span></div>
      </div>
    </section>

    <section className="api-toolbar page-card">
      <Input prefix={<IconSearch />} value={keyword} onChange={setKeyword} placeholder="搜索名称、路径、说明或控制器…" showClear />
      <Select value={module} onChange={setModule} style={{ width: 160 }} optionList={[
        { value: 'ALL', label: '全部模块' }, ...Object.keys(catalog?.modules || {}).map((value) => ({ value, label: `${value} (${catalog.modules[value]})` }))
      ]} />
      <Select value={method} onChange={setMethod} style={{ width: 125 }} optionList={['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map((value) => ({ value, label: value === 'ALL' ? '全部方法' : value }))} />
      <Select value={stateFilter} onChange={setStateFilter} style={{ width: 130 }} optionList={[
        { value: 'ALL', label: '全部状态' }, { value: 'ENABLED', label: '已启用' }, { value: 'DISABLED', label: '已停用' }, { value: 'PUBLIC', label: '公开接口' }
      ]} />
      <span className="api-result-count">显示 {filtered.length} 个</span>
      <Button icon={<IconDownload />} onClick={exportCatalog} disabled={!catalog}>导出目录</Button>
      <Button icon={<IconRefresh />} onClick={load} loading={loading}>刷新</Button>
    </section>

    <section className="api-table-card page-card">
      {loading ? <div className="api-loading"><Spin size="large" tip="正在扫描后端接口" /></div>
        : filtered.length ? <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOpts: [20, 50, 100] }} scroll={{ x: 980 }} />
          : <Empty description="没有符合条件的 API" style={{ padding: 70 }} />}
    </section>

    <SideSheet className="api-doc-sheet" title="API 文档" visible={!!selected} onCancel={() => setSelected(null)} width={Math.min(720, window.innerWidth)}>
      {selected && <ApiDocument item={selected} onRun={() => openRunner(selected)} onCopy={copy} curl={curl(selected)} />}
    </SideSheet>

    <Modal className="api-runner-modal" title={<span><IconCode /> 在线调试 · {runner?.name}</span>} visible={!!runner} onCancel={() => setRunner(null)} footer={null} width={Math.min(820, window.innerWidth - 24)}>
      {runner && <div className="api-runner">
        <div className="api-request-line"><Tag color={METHOD_COLORS[runner.method]}>{runner.method}</Tag><code>{runner.path}</code><Button size="small" theme="borderless" icon={<IconCopy />} onClick={() => copy(curl(), 'cURL 已复制')}>复制 cURL</Button></div>
        {(runner.parameters || []).filter((p) => p.location === 'path').length > 0 && <RunnerFields title="路径参数" fields={runner.parameters.filter((p) => p.location === 'path')} values={pathValues} onChange={setPathValues} />}
        {(runner.parameters || []).filter((p) => p.location === 'query').length > 0 && <RunnerFields title="查询参数" fields={runner.parameters.filter((p) => p.location === 'query')} values={queryValues} onChange={setQueryValues} />}
        {runner.requestBody && <div className="api-runner-section"><label>JSON 请求体 <small>{runner.requestBody.type}</small></label><TextArea value={bodyText} onChange={setBodyText} autosize={{ minRows: 7, maxRows: 16 }} /></div>}
        {(runner.parameters || []).some((p) => p.location === 'file') && <div className="api-file-tip">该接口包含文件参数，Web 调试器不会代替你选择本地文件，请复制 cURL 后在终端补充 <code>-F</code> 参数。</div>}
        <div className="api-runner-actions"><Button theme="solid" type="primary" icon={<IconPlay />} loading={running} disabled={!runner.enabled} onClick={run}>发送请求</Button><Text type="tertiary">请求会携带当前登录令牌并真实访问本地环境</Text></div>
        {result && <div className={`api-response ${result.ok ? 'is-success' : 'is-error'}`}><div><strong>HTTP {result.status}</strong><span>{result.duration} ms</span><span>{result.contentType}</span></div><pre>{pretty(result.payload)}</pre></div>}
      </div>}
    </Modal>
  </div>
}

function RunnerFields({ title, fields, values, onChange }) {
  return <div className="api-runner-section"><label>{title}</label><div className="api-runner-grid">{fields.map((field) => <div key={field.name}><span>{field.name}{field.required && <em>*</em>}<small>{field.type}</small></span><Input value={values[field.name]} onChange={(value) => onChange((current) => ({ ...current, [field.name]: value }))} placeholder={field.description} /></div>)}</div></div>
}

function ApiDocument({ item, onRun, onCopy, curl }) {
  const bodyFields = item.requestBody?.fields || []
  return <div className="api-document">
    <div className="api-doc-head"><div><Tag color={METHOD_COLORS[item.method]}>{item.method}</Tag><Tag color={item.enabled ? 'green' : 'red'}>{item.enabled ? '已启用' : '已停用'}</Tag>{item.protectedEndpoint && <Tag color="violet">保护接口</Tag>}</div><Title heading={4}>{item.name}</Title><Text type="tertiary">{item.description}</Text></div>
    <div className="api-path-box"><code>{item.path}</code><Button theme="borderless" icon={<IconCopy />} onClick={() => onCopy(item.path, '接口路径已复制')} /></div>
    <div className="api-doc-meta"><div><span>模块</span><strong>{item.module}</strong></div><div><span>权限</span><strong>{item.permission}</strong></div><div><span>认证</span><strong>{item.publicApi ? '无需登录' : 'Bearer Token'}</strong></div><div><span>返回类型</span><strong>{item.responseType}</strong></div></div>
    {item.accessRule && <div className="api-access-rule"><span>角色规则</span><code>{item.accessRule}</code></div>}
    <DocTable title="请求参数" rows={item.parameters || []} />
    {item.requestBody && <><div className="api-body-type"><span>请求体</span><code>{item.requestBody.type}</code>{item.requestBody.required ? <Tag color="red">必填</Tag> : <Tag>可选</Tag>}</div>{bodyFields.length ? <DocTable title="请求体字段" rows={bodyFields} body /> : <Text type="tertiary">自由 JSON 对象，请根据业务配置传入键值。</Text>}</>}
    <div className="api-curl"><div><span>cURL 示例</span><Button size="small" theme="borderless" icon={<IconCopy />} onClick={() => onCopy(curl, 'cURL 已复制')}>复制</Button></div><pre>{curl}</pre></div>
    <Space className="api-doc-actions"><Button theme="solid" type="primary" icon={<IconPlay />} disabled={!item.enabled} onClick={onRun}>在线调试</Button><Text type="tertiary">来源：{item.source}</Text></Space>
  </div>
}

function DocTable({ title, rows, body = false }) {
  if (!rows.length) return <div className="api-doc-section"><h4>{title}</h4><Text type="tertiary">无参数</Text></div>
  return <div className="api-doc-section"><h4>{title}</h4><div className="api-param-table"><div><b>名称</b><b>位置/类型</b><b>必填</b><b>说明</b></div>{rows.map((row) => <div key={`${row.location || 'body'}-${row.name}`}><code>{row.name}</code><span>{body ? row.type : `${LOCATION_LABELS[row.location] || row.location} · ${row.type}`}</span><span>{row.required ? '是' : '否'}</span><span>{row.description}{row.defaultValue != null ? `（默认 ${row.defaultValue}）` : ''}</span></div>)}</div></div>
}
