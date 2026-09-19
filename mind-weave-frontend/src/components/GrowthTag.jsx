import { Tag } from '@douyinfe/semi-ui'

export default function GrowthTag({ value }) {
  if (value === null || value === undefined) return <span>—</span>
  const text = `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  return <Tag color={value >= 0 ? 'green' : 'red'}>{text}</Tag>
}
