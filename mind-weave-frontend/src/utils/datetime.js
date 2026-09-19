// 统一日期时间格式：日期 yyyy-MM-dd，时间 HH:mm:ss，日期时间 yyyy-MM-dd HH:mm:ss
export const fmtDate = (v) => (v ? String(v).slice(0, 10) : '')
export const fmtTime = (v) => (v ? String(v).slice(11, 19) : '')
export const fmtDateTime = (v) => (v ? String(v).slice(0, 19).replace('T', ' ') : '')
