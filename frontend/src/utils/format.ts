/**
 * 将入参安全转换为有限数值。
 * 后端 Pydantic + SQLAlchemy Numeric 序列化的金额/百分比字段常以字符串形式返回以保留精度，
 * 此函数同时兼容 number / string / decimal-like 字符串，统一返回 number，便于调用 toFixed 等方法。
 */
const toSafeNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * 格式化数字
 */
export const formatNumber = (num: number | string, decimals: number = 2): string => {
  return toSafeNumber(num).toFixed(decimals)
}

/**
 * 格式化百分比（带正负号）
 */
export const formatPercent = (num: number | string, decimals: number = 2): string => {
  const n = toSafeNumber(num)
  return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%'
}

/**
 * 格式化货帀
 */
export const formatCurrency = (num: number | string, symbol: string = '¥'): string => {
  const n = toSafeNumber(num)
  return symbol + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 格式化日期
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

/**
 * 格式化大额数字（带单位：万/亿）
 */
export const formatLargeNumber = (num: number | string, decimals: number = 2): string => {
  const n = toSafeNumber(num)
  if (Math.abs(n) >= 100000000) {
    return (n / 100000000).toFixed(decimals) + '亿'
  }
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(decimals) + '万'
  }
  return n.toFixed(decimals)
}

/**
 * 格式化大额货币（带单位：万/亿）
 */
export const formatLargeCurrency = (num: number | string, symbol: string = '¥'): string => {
  return symbol + formatLargeNumber(num)
}

/**
 * 获取涨跌颜色类名（红涨绿跌，A股惯例）
 */
export const getProfitColor = (value: number | string): string => {
  const n = toSafeNumber(value)
  if (n > 0) return '#ef4444'
  if (n < 0) return '#22c55e'
  return '#666'
}

/**
 * 获取涨跌背景颜色类名
 */
export const getProfitBgColor = (value: number | string): string => {
  const n = toSafeNumber(value)
  if (n > 0) return 'rgba(239, 68, 68, 0.1)'
  if (n < 0) return 'rgba(34, 197, 94, 0.1)'
  return 'rgba(102, 102, 102, 0.1)'
}