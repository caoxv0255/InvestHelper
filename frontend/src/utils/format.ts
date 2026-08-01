/**
 * 格式化数字
 * @param num 数字
 * @param decimals 小数位数
 */
export const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toFixed(decimals)
}

/**
 * 格式化百分比（带正负号）
 * @param num 百分比数值（如 5.2 表示 5.2%）
 * @param decimals 小数位数
 */
export const formatPercent = (num: number, decimals: number = 2): string => {
  return `${num >= 0 ? '+' : ''}${num.toFixed(decimals)}%`
}

/**
 * 格式化货币
 * @param num 金额
 * @param symbol 货币符号
 */
export const formatCurrency = (num: number, symbol: string = '¥'): string => {
  return `${symbol}${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * 格式化日期
 * @param date 日期
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化大额数字（带单位：万/亿）
 * @param num 数字
 * @param decimals 小数位数
 */
export const formatLargeNumber = (num: number, decimals: number = 2): string => {
  if (Math.abs(num) >= 100000000) {
    return `${(num / 100000000).toFixed(decimals)}亿`
  }
  if (Math.abs(num) >= 10000) {
    return `${(num / 10000).toFixed(decimals)}万`
  }
  return num.toFixed(decimals)
}

/**
 * 格式化大额货币（带单位：万/亿）
 * @param num 金额
 * @param symbol 货币符号
 */
export const formatLargeCurrency = (num: number, symbol: string = '¥'): string => {
  return `${symbol}${formatLargeNumber(num)}`
}

/**
 * 获取涨跌颜色类名（红涨绿跌，A股惯例）
 * @param value 数值，正数为涨，负数为跌
 */
export const getProfitColor = (value: number): string => {
  if (value > 0) return '#ef4444'
  if (value < 0) return '#22c55e'
  return '#666'
}

/**
 * 获取涨跌背景颜色类名
 * @param value 数值，正数为涨，负数为跌
 */
export const getProfitBgColor = (value: number): string => {
  if (value > 0) return 'rgba(239, 68, 68, 0.1)'
  if (value < 0) return 'rgba(34, 197, 94, 0.1)'
  return 'rgba(102, 102, 102, 0.1)'
}
