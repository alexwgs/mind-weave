import { Tooltip } from '@douyinfe/semi-ui'
import { fmtMoney } from '../utils'

export default function CommentCell({ value, comments, money }) {
  const list = comments || []
  if (!list.length) {
    return <span className="cell-value">{value === null || value === undefined || value === '' ? '—' : money ? fmtMoney(value) : String(value)}</span>
  }
  const text = list.map((c) => `[${c.fieldCode}] ${c.content}`).join('\n')
  return (
    <Tooltip content={<pre className="comment-tip">{text}</pre>} position="top" showArrow>
      <span className="cell-value has-comment">{money ? fmtMoney(value) : value ?? '—'}</span>
    </Tooltip>
  )
}
