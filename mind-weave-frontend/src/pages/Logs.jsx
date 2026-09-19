import { useEffect, useState } from 'react'
import { Button, Input, Table } from '@douyinfe/semi-ui'
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons'
import { logApi } from '../api'

export default function Logs() {
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [operator, setOperator] = useState('')
  const [action, setAction] = useState('')

  const load = async (p, s) => {
    setLoading(true)
    try {
      const data = await logApi.page({
        page: p || page, size: s || size,
        operator: operator || undefined,
        action: action || undefined
      })
      setList(data.records)
      setTotal(data.total)
      setPage(p || page)
      if (s) setSize(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '时间', dataIndex: 'createdAt', width: 180 },
    { title: '操作人', dataIndex: 'operator', width: 120 },
    { title: '动作', dataIndex: 'action', width: 150 },
    { title: '对象', dataIndex: 'targetType', width: 110 },
    { title: '对象ID', dataIndex: 'targetId', width: 90 },
    { title: '详情', dataIndex: 'detail', width: 280 }
  ]

  return (
    <div>
      <div className="page-card filter-bar">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Input placeholder="操作人" value={operator} onChange={setOperator} style={{ width: 150 }} />
          <Input placeholder="动作（如 IMPORT / LOGIN）" value={action} onChange={setAction} style={{ width: 190 }} onEnterPress={() => load(1)} />
          <Button theme="solid" icon={<IconSearch />} onClick={() => load(1)}>查询</Button>
          <Button icon={<IconRefresh />} onClick={() => { setOperator(''); setAction(''); setTimeout(() => load(1), 0) }}>重置</Button>
        </div>
      </div>
      <div className="page-card">
        <Table
          columns={columns}
          dataSource={list}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            currentPage: page,
            pageSize: size,
            total,
            onPageChange: (p) => load(p),
            showSizeChanger: true,
            pageSizeOpts: [20, 50, 100, 500],
            onPageSizeChange: (s) => load(1, s)
          }}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  )
}
