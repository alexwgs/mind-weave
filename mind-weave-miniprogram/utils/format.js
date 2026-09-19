/**
 * 字段分组与格式化，与 Web 端口径保持一致
 * 另发奖金 = 其他奖金 + 年度实发
 */
const GROUPS = [
  {
    key: 'income',
    label: '加项合计',
    totalKey: 'totalIncome',
    tint: '',
    fields: [
      { key: 'postSalary', label: '岗位工资' },
      { key: 'regionAllowance', label: '地区补贴' },
      { key: 'bonus', label: '奖金' },
      { key: 'otherIncome', label: '其他' },
      { key: 'postSubsidy', label: '岗位津贴' },
      { key: 'overtimePay', label: '加班工资' },
      { key: 'housingSubsidy', label: '购房补贴' },
      { key: 'workAllowance', label: '工作补贴' },
      { key: 'otherAdjust', label: '其他/补差' }
    ]
  },
  {
    key: 'deduction',
    label: '扣项合计',
    totalKey: 'totalDeduction',
    tint: 'g-deduction',
    fields: [
      { key: 'pensionPersonal', label: '养老保险' },
      { key: 'unemploymentPersonal', label: '失业保险' },
      { key: 'medicalPersonal', label: '医疗保险' },
      { key: 'housingFundPersonal', label: '住房公积金' },
      { key: 'annuityPersonal', label: '企业年金' },
      { key: 'incomeTax', label: '个人所得税' }
    ]
  },
  {
    key: 'company',
    label: '公司合计',
    totalKey: 'companyTotal',
    tint: 'g-company',
    fields: [
      { key: 'pensionCompany', label: '养老保险' },
      { key: 'unemploymentCompany', label: '失业保险' },
      { key: 'medicalCompany', label: '医疗保险' },
      { key: 'injuryCompany', label: '工伤保险' },
      { key: 'maternityCompany', label: '生育保险' },
      { key: 'housingFundCompany', label: '住房公积金' },
      { key: 'annuityCompany', label: '企业年金' }
    ]
  },
  {
    key: 'extra',
    label: '另发奖金',
    totalKey: 'extraTotal',
    tint: 'g-extra',
    compute(row) {
      return (Number(row && row.otherBonus) || 0) + (Number(row && row.annualBonusNet) || 0)
    },
    fields: [
      { key: 'otherBonus', label: '其他奖金' },
      { key: 'annualBonusNet', label: '年度实发' }
    ]
  }
]

function fmtMoney(v) {
  const n = Number(v || 0)
  const fixed = n.toFixed(2)
  const parts = fixed.split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return intPart + '.' + parts[1]
}

function fmtShort(v) {
  const n = Number(v || 0)
  if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(1) + '亿'
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + '万'
  return fmtMoney(n)
}

function groupTotal(g, row) {
  if (g.compute) return g.compute(row)
  return Number(row && row[g.totalKey]) || 0
}

const FIELD_LABELS = {}
GROUPS.forEach((g) => {
  g.fields.forEach((f) => {
    FIELD_LABELS[f.key] = f.label
  })
})
FIELD_LABELS.netPay = '实发金额'
FIELD_LABELS.totalSalary = '总薪资'
FIELD_LABELS.totalIncome = '加项合计'
FIELD_LABELS.totalDeduction = '扣项合计'
FIELD_LABELS.companyTotal = '公司合计'

function fieldLabel(fieldCode) {
  return FIELD_LABELS[fieldCode] || fieldCode
}

function fmtMonth(month) {
  if (!month) return ''
  const m = String(month).slice(0, 7)
  const parts = m.split('-')
  return parts.length === 2 ? parts[0] + '年' + Number(parts[1]) + '月' : m
}

module.exports = {
  GROUPS,
  fmtMoney,
  fmtShort,
  groupTotal,
  fieldLabel,
  FIELD_LABELS,
  fmtMonth
}
