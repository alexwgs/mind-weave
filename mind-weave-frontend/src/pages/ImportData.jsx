import { useEffect, useState } from 'react'
import { Banner, Button, Radio, Table, Tag, Toast, Upload } from '@douyinfe/semi-ui'
import { IconRefresh, IconUpload } from '@douyinfe/semi-icons'
import { importApi } from '../api'
import { fmtMoney } from '../utils'

export default function ImportData() {
  const [fileList, setFileList] = useState([])
  const [rawFile, setRawFile] = useState(null)
  const [mode, setMode] = useState('append')
  const [previewing, setPreviewing] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [batches, setBatches] = useState([])
  const [batchLoading, setBatchLoading] = useState(false)

  const loadBatches = async () => {
    setBatchLoading(true)
    try {
      const data = await importApi.batches({ page: 1, size: 20 })
      setBatches(data.records)
    } finally {
      setBatchLoading(false)
    }
  }

  useEffect(() => {
    loadBatches()
  }, [])

  const onFileChange = ({ fileList: fl }) => {
    setFileList(fl)
    const last = fl[fl.length - 1]
    setRawFile(last?.file || null)
    setPreview(null)
  }

  const previewNow = async () => {
    if (!rawFile) {
      Toast.warning('请先选择文件')
      return
    }
    setPreviewing(true)
    try {
      setPreview(await importApi.preview(rawFile))
      Toast.success('解析完成')
    } finally {
      setPreviewing(false)
    }
  }

  const execute = async () => {
    if (!rawFile || !preview) return
    setExecuting(true)
    try {
      const result = await importApi.execute(rawFile, mode)
      if (result.errors?.length) {
        Toast.error(result.errors.join('；'))
      } else {
        Toast.success(`导入成功：${result.recordCount} 条记录，${result.commentCount} 条批注`)
        setPreview(null)
        setFileList([])
        setRawFile(null)
        loadBatches()
      }
    } finally {
      setExecuting(false)
    }
  }

  const previewColumns = [
    { title: '#', width: 55, render: (_, __, index) => index + 1 },
    { title: '月份', dataIndex: 'month', width: 110, render: (v) => v?.slice(0, 7) },
    { title: '考核', dataIndex: 'grade', width: 80 },
    { title: '加项合计', dataIndex: 'totalIncome', width: 100, align: 'right', render: fmtMoney },
    { title: '实发金额', dataIndex: 'netPay', width: 100, align: 'right', render: fmtMoney },
    { title: '总薪资', dataIndex: 'totalSalary', width: 100, align: 'right', render: fmtMoney },
    {
      title: '批注', width: 120,
      render: (_, row) => (row.comments?.length ? <Tag color="orange" size="small">{row.comments.length} 条</Tag> : '—')
    },
    {
      title: '批注内容', width: 240,
      render: (_, row) => (
        <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
          {(row.comments || []).map((c) => `${c.fieldCode}: ${c.content}`).join(' ')}
        </span>
      )
    }
  ]

  const batchColumns = [
    { title: '批次', dataIndex: 'id', width: 80 },
    { title: '文件名', dataIndex: 'fileName', width: 180 },
    { title: '导入人', dataIndex: 'importBy', width: 100 },
    { title: '记录数', dataIndex: 'totalRows', width: 90, align: 'center' },
    { title: '导入时间', dataIndex: 'importTime', width: 180 },
    { title: '预警', dataIndex: 'warnMsg', width: 200, render: (v) => v || '—' }
  ]

  return (
    <div>
      <div className="page-card">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Excel 导入</div>
        <Upload
          accept=".xlsx"
          showFileList
          fileList={fileList}
          onChange={onFileChange}
          draggable
          dragIcon={<IconUpload size="large" />}
          dragMainText="将 工资明细表.xlsx 拖到此处，或点击选择文件"
          dragSubText="只支持 .xlsx；解析“工资” sheet、公式缓存值及全部批注"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
          <Radio.Group type="button" value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio value="append">增量导入（已存在月份报错）</Radio>
            <Radio value="replace">替换导入（清空后重新导入）</Radio>
          </Radio.Group>
          <Button theme="solid" loading={previewing} onClick={previewNow}>解析预览</Button>
          <Button theme="solid" type="primary" disabled={!preview} loading={executing} onClick={execute}>确认导入</Button>
          <Button icon={<IconRefresh />} onClick={loadBatches}>刷新批次</Button>
        </div>
        {preview?.warnings?.length > 0 && (
          <Banner
            type="warning"
            showCloseIcon={false}
            style={{ marginTop: 14 }}
            title={`预警 ${preview.warnings.length} 条`}
            description={preview.warnings.join('；')}
          />
        )}
      </div>

      {preview && (
        <div className="page-card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>解析结果：{preview.records.length} 条记录</div>
          <Table columns={previewColumns} dataSource={preview.records} rowKey={(r) => r.month} size="small" pagination={false} scroll={{ x: 'max-content', y: 420 }} />
        </div>
      )}

      <div className="page-card">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>导入批次历史</div>
        <Table columns={batchColumns} dataSource={batches} rowKey="id" loading={batchLoading} size="small" pagination={false} />
      </div>
    </div>
  )
}
