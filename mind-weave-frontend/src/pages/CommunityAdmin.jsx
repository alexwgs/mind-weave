import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Modal, Select, Space, Switch, Table, Tabs, Tag, TextArea, Toast, Typography } from '@douyinfe/semi-ui'
import { IconPlus, IconRefresh, IconTick, IconClose, IconDelete, IconEdit } from '@douyinfe/semi-icons'
import dayjs from 'dayjs'
import { communityApi } from '../api'
import { ChatContent } from '../components/community'
import '../community.css'

const { TabPane } = Tabs
const { Text } = Typography
const TYPES = [
  { value: 'CHAT', label: '会客厅消息' },
  { value: 'GUESTBOOK', label: '留言板' },
  { value: 'ARTICLE', label: '文章评论' }
]
const STATUS = { PENDING: ['amber', '待审核'], APPROVED: ['green', '已通过'], REJECTED: ['red', '已拒绝'] }

export default function CommunityAdmin() {
  const [tab, setTab] = useState('moderation')
  const [type, setType] = useState('CHAT')
  const [status, setStatus] = useState('PENDING')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [rooms, setRooms] = useState([])
  const [roomVisible, setRoomVisible] = useState(false)
  const [roomForm, setRoomForm] = useState({ id: null, name: '', description: '', sortOrder: 0 })
  const [agents, setAgents] = useState([])
  const [agentVisible, setAgentVisible] = useState(false)
  const [agentForm, setAgentForm] = useState({ id: null, name: '', prompt: '', enabled: true })
  const roomNames = useMemo(() => Object.fromEntries(rooms.map((room) => [room.id, room.name])), [rooms])
  const isChat = type === 'CHAT'

  const loadRows = async () => {
    setLoading(true)
    try {
      // 会客厅消息发布即公开，不进审核队列，因此固定按「全部」拉取
      const page = await communityApi.moderation({ type, status: isChat ? 'ALL' : status, page: 1, size: 100 })
      setRows(page.records || [])
    } finally { setLoading(false) }
  }
  const loadRooms = async () => setRooms(await communityApi.adminRooms())
  const loadAgents = async () => setAgents(await communityApi.adminAiAgents())

  useEffect(() => { loadRooms() }, [])
  useEffect(() => { if (tab === 'agents') loadAgents() }, [tab])
  useEffect(() => { if (tab === 'moderation') loadRows() }, [tab, type, status]) // eslint-disable-line

  const review = async (row, next) => {
    await communityApi.review(type, row.id, next)
    Toast.success(next === 'APPROVED' ? '已通过并公开显示' : '已拒绝')
    loadRows()
  }
  const remove = (row) => Modal.confirm({ title: '删除这条内容？', content: '删除后不可恢复。', okType: 'danger', onOk: async () => { await communityApi.deletePost(type, row.id); loadRows() } })

  const columns = [
    { title: '发布者', width: 130, render: (_, row) => <Space><span>{row.authorName}</span><Tag size="small" color={row.authorType === 'USER' ? 'green' : 'grey'}>{row.authorType === 'USER' ? '成员' : '游客'}</Tag></Space> },
    { title: '位置', width: 130, render: (_, row) => type === 'CHAT' ? (roomNames[row.roomId] || `房间 #${row.roomId}`) : type === 'ARTICLE' ? `文章 #${row.articleId}` : '留言板' },
    { title: '内容', dataIndex: 'content', render: (value) => <div className="community-admin-content"><ChatContent content={value} /></div> },
    { title: '提交时间', dataIndex: 'createdAt', width: 150, render: (value) => dayjs(value).format('MM-DD HH:mm') },
    { title: '状态', dataIndex: 'status', width: 90, render: (value) => isChat ? <Tag color="green">已公开</Tag> : <Tag color={STATUS[value]?.[0] || 'grey'}>{STATUS[value]?.[1] || value}</Tag> },
    { title: '操作', width: isChat ? 92 : 184, fixed: 'right', render: (_, row) => <Space spacing="tight">{!isChat && <><Button size="small" type="primary" icon={<IconTick />} disabled={row.status === 'APPROVED'} onClick={() => review(row, 'APPROVED')}>通过</Button><Button size="small" icon={<IconClose />} disabled={row.status === 'REJECTED'} onClick={() => review(row, 'REJECTED')}>拒绝</Button></>}<Button size="small" theme="borderless" type="danger" icon={<IconDelete />} aria-label="删除" onClick={() => remove(row)} /></Space> }
  ]

  const saveRoom = async () => {
    if (roomForm.name.trim().length < 2) return Toast.warning('房间名称至少 2 个字符')
    const payload = { name: roomForm.name.trim(), description: roomForm.description.trim(), sortOrder: roomForm.sortOrder }
    if (roomForm.id) await communityApi.updateRoom(roomForm.id, payload)
    else await communityApi.createRoom(payload)
    setRoomVisible(false); setRoomForm({ id: null, name: '', description: '', sortOrder: 0 }); loadRooms(); Toast.success(roomForm.id ? '房间已修改' : '房间已创建')
  }
  const openCreateRoom = () => { setRoomForm({ id: null, name: '', description: '', sortOrder: 0 }); setRoomVisible(true) }
  const openEditRoom = (room) => { setRoomForm({ id: room.id, name: room.name || '', description: room.description || '', sortOrder: room.sortOrder || 0 }); setRoomVisible(true) }

  const saveAgentList = async (next) => {
    const saved = await communityApi.saveAiAgents(next)
    setAgents(saved)
    Toast.success('AI 成员配置已保存')
  }
  const saveAgent = async () => {
    if (agentForm.name.trim().length < 2) return Toast.warning('AI 名称至少 2 个字符')
    if (!agentForm.prompt.trim()) return Toast.warning('请填写基础提示词')
    const value = { ...agentForm, name: agentForm.name.trim(), prompt: agentForm.prompt.trim() }
    const next = agentForm.id ? agents.map((agent) => agent.id === agentForm.id ? value : agent) : [...agents, value]
    await saveAgentList(next)
    setAgentVisible(false)
  }
  const removeAgent = (agent) => Modal.confirm({ title: `删除「${agent.name}」？`, content: '删除后将不能再在会客厅中 @ 该 AI。', okType: 'danger', onOk: () => saveAgentList(agents.filter((item) => item.id !== agent.id)) })

  return (
    <div className="community-admin">
      <Tabs activeKey={tab} onChange={setTab}>
        <TabPane tab="内容审核" itemKey="moderation">
          <Card>
            <Space wrap style={{ marginBottom: 16 }}>
              <Select value={type} onChange={setType} optionList={TYPES} style={{ width: 160 }} />
              {!isChat && <Select value={status} onChange={setStatus} optionList={[{ value: 'PENDING', label: '待审核' }, { value: 'APPROVED', label: '已通过' }, { value: 'REJECTED', label: '已拒绝' }, { value: 'ALL', label: '全部' }]} style={{ width: 130 }} />}
              <Button icon={<IconRefresh />} onClick={loadRows}>刷新</Button>
              <Text type="tertiary">{isChat ? '会客厅消息发布即公开，无需审核；如内容不合适，可直接删除。' : '提交内容不会直接公开，必须在这里审核通过。'}</Text>
            </Space>
            <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={false} scroll={{ x: 950 }} />
          </Card>
        </TabPane>
        <TabPane tab="聊天室房间" itemKey="rooms">
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><Text type="tertiary">可以修改房间名称、说明与排序；关闭后公开端不再显示。</Text><Button type="primary" icon={<IconPlus />} onClick={openCreateRoom}>创建房间</Button></div>
            <Table rowKey="id" pagination={false} dataSource={rooms} columns={[
              { title: '房间', render: (_, row) => <div><strong>{row.name}</strong><div><Text type="tertiary" size="small">{row.description || '暂无说明'}</Text></div></div> },
              { title: '排序', dataIndex: 'sortOrder', width: 90 },
              { title: '开放', width: 100, render: (_, row) => <Switch checked={row.active === 1} onChange={async (checked) => { await communityApi.updateRoom(row.id, { active: checked }); loadRooms() }} /> },
              { title: '操作', width: 90, render: (_, row) => <Button size="small" theme="borderless" icon={<IconEdit />} onClick={() => openEditRoom(row)}>修改</Button> }
            ]} />
          </Card>
        </TabPane>
        <TabPane tab="AI 成员" itemKey="agents">
          <Card>
            <div className="community-agent-head"><div><strong>会客厅 AI 成员</strong><Text type="tertiary">登录用户可以在会客厅中 @ 已启用的 AI。回复使用“系统设置”里的 AI 模型配置。</Text></div><Button type="primary" icon={<IconPlus />} onClick={() => { setAgentForm({ id: null, name: '', prompt: '', enabled: true }); setAgentVisible(true) }}>添加 AI</Button></div>
            <Table rowKey="id" pagination={false} dataSource={agents} columns={[
              { title: 'AI 名称', width: 180, render: (_, agent) => <div className="community-agent-name"><span>梦</span><strong>{agent.name}</strong></div> },
              { title: '角色提示词', dataIndex: 'prompt', render: (value) => <div className="community-agent-prompt">{value}</div> },
              { title: '启用', width: 90, render: (_, agent) => <Switch checked={agent.enabled} onChange={(enabled) => saveAgentList(agents.map((item) => item.id === agent.id ? { ...item, enabled } : item))} /> },
              { title: '操作', width: 150, render: (_, agent) => <Space spacing="tight"><Button size="small" theme="borderless" icon={<IconEdit />} onClick={() => { setAgentForm({ ...agent }); setAgentVisible(true) }}>编辑</Button><Button size="small" theme="borderless" type="danger" icon={<IconDelete />} onClick={() => removeAgent(agent)}>删除</Button></Space> }
            ]} />
          </Card>
        </TabPane>
      </Tabs>
      <Modal title={roomForm.id ? '修改聊天室房间' : '创建聊天室房间'} visible={roomVisible} onOk={saveRoom} onCancel={() => setRoomVisible(false)} okText={roomForm.id ? '保存修改' : '创建房间'} cancelText="取消">
        <Space vertical align="start" style={{ width: '100%' }}>
          <div style={{ width: '100%' }}><Text strong>房间名称</Text><Input value={roomForm.name} onChange={(name) => setRoomForm((f) => ({ ...f, name }))} maxLength={50} placeholder="例如：技术闲聊" style={{ marginTop: 7 }} /></div>
          <div style={{ width: '100%' }}><Text strong>房间说明</Text><TextArea value={roomForm.description} onChange={(description) => setRoomForm((f) => ({ ...f, description }))} maxLength={500} rows={3} placeholder="告诉访客这里适合聊什么" style={{ marginTop: 7 }} /></div>
          <div style={{ width: '100%' }}><Text strong>排序</Text><Input type="number" value={roomForm.sortOrder} onChange={(sortOrder) => setRoomForm((f) => ({ ...f, sortOrder: Number(sortOrder) || 0 }))} style={{ marginTop: 7 }} /></div>
        </Space>
      </Modal>
      <Modal title={agentForm.id ? '编辑 AI 成员' : '添加 AI 成员'} visible={agentVisible} onOk={saveAgent} onCancel={() => setAgentVisible(false)} okText="保存配置" cancelText="取消" width={620}>
        <div className="community-agent-form"><label><span>AI 名称</span><Input value={agentForm.name} onChange={(name) => setAgentForm((form) => ({ ...form, name }))} maxLength={24} placeholder="例如：AI梦梦" /></label><label><span>基础提示词</span><TextArea value={agentForm.prompt} onChange={(prompt) => setAgentForm((form) => ({ ...form, prompt }))} maxCount={1500} autosize={{ minRows: 8, maxRows: 14 }} placeholder="描述这个 AI 的身份、性格、擅长领域和回答方式…" /></label><label className="community-agent-switch"><Switch checked={agentForm.enabled} onChange={(enabled) => setAgentForm((form) => ({ ...form, enabled }))} /><span>在会客厅的 @ 列表中启用</span></label></div>
      </Modal>
    </div>
  )
}
