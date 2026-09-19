export function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '—'
  return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const FIELD_LETTER = {
  postSalary: 'C', regionAllowance: 'D', bonus: 'E', otherIncome: 'F', postSubsidy: 'G',
  overtimePay: 'H', housingSubsidy: 'I', workAllowance: 'J', otherAdjust: 'K', totalIncome: 'L',
  pensionPersonal: 'M', unemploymentPersonal: 'N', medicalPersonal: 'O', housingFundPersonal: 'P',
  annuityPersonal: 'Q', incomeTax: 'R', totalDeduction: 'S', netPay: 'T',
  pensionCompany: 'U', unemploymentCompany: 'V', medicalCompany: 'W', injuryCompany: 'X',
  maternityCompany: 'Y', housingFundCompany: 'Z', annuityCompany: 'AA', companyTotal: 'AB',
  otherBonus: 'AC', annualBonus: 'AD', annualBonusTax: 'AE', annualBonusNet: 'AF'
}

export function fieldComments(row, key) {
  const letter = FIELD_LETTER[key]
  if (!letter || !row.comments?.length) return []
  return row.comments.filter((c) => c.fieldCode === letter)
}
