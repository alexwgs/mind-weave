import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Modal, Select, Space, Switch, Table, Tabs, Tag, TextArea, Toast, Typography } from '@douyinfe/semi-ui'
import { IconPlus, IconRefresh, IconTick, IconClose, IconDelete } from '@douyinfe/semi-icons'
import dayjs from 'dayjs'
import { communityApi } from '../api'

const { TabPane } = Tabs
const { Text } = Typography
const TYPES = [
  { value: 'CHAT', label: '聊天室消息' },
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
  const [roomForm, setRoomForm] = useState({ name: '', description: '', sortOrder: 0 })
  const roomNames = useMemo(() => Object.fromEntries(rooms.map((room) => [room.id, room.name])), [rooms])

  const loadRows = async () => {
    setLoading(true)
    try {
      const page = await communityApi.moderation({ type, status, page: 1, size: 100 })
      setRows(page.records || [])
    } finally { setLoading(false) }
  }
  const loadRooms = async () => setRooms(await communityApi.adminRooms())

  useEffect(() => { loadRooms() }, [])
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
    { title: '内容', dataIndex: 'content', render: (value) => <div style={{ whiteSpace: 'pre-wrap', minWidth: 220 }}>{value}</div> },
    { title: '提交时间', dataIndex: 'createdAt', width: 150, render: (value) => dayjs(value).format('MM-DD HH:mm') },
    { title: '状态', dataIndex: 'status', width: 90, render: (value) => <Tag color={STATUS[value]?.[0] || 'grey'}>{STATUS[value]?.[1] || value}</Tag> },
    { title: '操作', width: 184, fixed: 'right', render: (_, row) => <Space spacing="tight"><Button size="small" type="primary" icon={<IconTick />} disabled={row.status === 'APPROVED'} onClick={() => review(row, 'APPROVED')}>通过</Button><Button size="small" icon={<IconClose />} disabled={row.status === 'REJECTED'} onClick={() => review(row, 'REJECTED')}>拒绝</Button><Button size="small" theme="borderless" type="danger" icon={<IconDelete />} aria-label="删除" onClick={() => remove(row)} /></Space> }
  ]

  const createRoom = async () => {
    if (roomForm.name.trim().length < 2) return Toast.warning('房间名称至少 2 个字符')
    await communityApi.createRoom({ ...roomForm, name: roomForm.name.trim(), description: roomForm.description.trim() })
    setRoomVisible(false); setRoomForm({ name: '', description: '', sortOrder: 0 }); loadRooms(); Toast.success('房间已创建')
  }

  return (
    <div className="community-admin">
      <Tabs activeKey={tab} onChange={setTab}>
        <TabPane tab="内容审核" itemKey="moderation">
          <Card>
            <Space wrap style={{ marginBottom: 16 }}>
              <Select value={type} onChange={setType} optionList={TYPES} style={{ width: 160 }} />
              <Select value={status} onChange={setStatus} optionList={[{ value: 'PENDING', label: '待审核' }, { value: 'APPROVED', label: '已通过' }, { value: 'REJECTED', label: '已拒绝' }, { value: 'ALL', label: '全部' }]} style={{ width: 130 }} />
              <Button icon={<IconRefresh />} onClick={loadRows}>刷新</Button>
              <Text type="tertiary">提交内容不会直接公开，必须在这里审核通过。</Text>
            </Space>
            <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={false} scroll={{ x: 950 }} />
          </Card>
        </TabPane>
        <TabPane tab="聊天室房间" itemKey="rooms">
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><Text type="tertiary">关闭房间后，公开端不再显示，也不能继续发言。</Text><Button type="primary" icon={<IconPlus />} onClick={() => setRoomVisible(true)}>创建房间</Button></div>
            <Table rowKey="id" pagination={false} dataSource={rooms} columns={[
              { title: '房间', render: (_, row) => <div><strong>{row.name}</strong><div><Text type="tertiary" size="small">{row.description || '暂无说明'}</Text></div></div> },
              { title: '排序', dataIndex: 'sortOrder', width: 90 },
              { title: '开放', width: 100, render: (_, row) => <Switch checked={row.active === 1} onChange={async (checked) => { await communityApi.updateRoom(row.id, { active: checked }); loadRooms() }} /> }
            ]} />
          </Card>
        </TabPane>
      </Tabs>
      <Modal title="创建聊天室房间" visible={roomVisible} onOk={createRoom} onCancel={() => setRoomVisible(false)} okText="创建房间" cancelText="取消">
        <Space vertical align="start" style={{ width: '100%' }}>
          <div style={{ width: '100%' }}><Text strong>房间名称</Text><Input value={roomForm.name} onChange={(name) => setRoomForm((f) => ({ ...f, name }))} maxLength={50} placeholder="例如：技术闲聊" style={{ marginTop: 7 }} /></div>
          <div style={{ width: '100%' }}><Text strong>房间说明</Text><TextArea value={roomForm.description} onChange={(description) => setRoomForm((f) => ({ ...f, description }))} maxLength={500} rows={3} placeholder="告诉访客这里适合聊什么" style={{ marginTop: 7 }} /></div>
          <div style={{ width: '100%' }}><Text strong>排序</Text><Input type="number" value={roomForm.sortOrder} onChange={(sortOrder) => setRoomForm((f) => ({ ...f, sortOrder: Number(sortOrder) || 0 }))} style={{ marginTop: 7 }} /></div>
        </Space>
      </Modal>
    </div>
  )
}
