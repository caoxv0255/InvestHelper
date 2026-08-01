import type { KLineData, MALineData, MACDData, KDJData, VolumeData } from '../types'

/**
 * 计算简单移动平均线（SMA / MA）
 * @param data K线数据数组
 * @param period 周期，默认 5
 * @returns 均线数据数组，前 period-1 条无值
 */
export const calculateMA = (data: KLineData[], period: number = 5): MALineData[] => {
  if (period <= 0 || data.length < period) return []

  const result: MALineData[] = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close
    }
    result.push({
      time: data[i].date,
      value: sum / period,
    })
  }
  return result
}

/**
 * 计算指数移动平均线（EMA）
 * @param data K线数据数组
 * @param period 周期
 * @returns EMA 数组，与 data 长度一致，前 period-1 条无值
 */
const calculateEMA = (data: KLineData[], period: number): (number | null)[] => {
  const k = 2 / (period + 1)
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length === 0 || period <= 0) return result

  let ema = data[0].close
  result[0] = ema
  for (let i = 1; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k)
    result[i] = ema
  }
  return result
}

/**
 * 计算 MACD 指标
 * @param data K线数据数组
 * @param fast 快线周期，默认 12
 * @param slow 慢线周期，默认 26
 * @param signal DEA 周期，默认 9
 * @returns MACD 指标数据数组
 */
export const calculateMACD = (
  data: KLineData[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9,
): MACDData[] => {
  if (data.length < slow) return []

  const emaFast = calculateEMA(data, fast)
  const emaSlow = calculateEMA(data, slow)

  const dif: (number | null)[] = new Array(data.length).fill(null)
  for (let i = 0; i < data.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      dif[i] = emaFast[i]! - emaSlow[i]!
    }
  }

  // 计算 DEA（DIF 的 EMA）
  const dea: (number | null)[] = new Array(data.length).fill(null)
  let validStart = 0
  while (validStart < data.length && dif[validStart] === null) validStart++

  if (validStart < data.length) {
    let emaDea = dif[validStart]!
    dea[validStart] = emaDea
    const k = 2 / (signal + 1)
    for (let i = validStart + 1; i < data.length; i++) {
      emaDea = dif[i]! * k + emaDea * (1 - k)
      dea[i] = emaDea
    }
  }

  const result: MACDData[] = []
  for (let i = 0; i < data.length; i++) {
    if (dif[i] !== null && dea[i] !== null) {
      result.push({
        time: data[i].date,
        dif: dif[i]!,
        dea: dea[i]!,
        histogram: dif[i]! - dea[i]!,
      })
    }
  }
  return result
}

/**
 * 计算 KDJ 指标
 * @param data K线数据数组
 * @param n RSV 周期，默认 9
 * @param m1 K 平滑周期，默认 3
 * @param m2 D 平滑周期，默认 3
 * @returns KDJ 指标数据数组
 */
export const calculateKDJ = (
  data: KLineData[],
  n: number = 9,
  m1: number = 3,
  m2: number = 3,
): KDJData[] => {
  if (data.length < n) return []

  const rsv: (number | null)[] = new Array(data.length).fill(null)
  for (let i = n - 1; i < data.length; i++) {
    let lowMin = Infinity
    let highMax = -Infinity
    for (let j = i - n + 1; j <= i; j++) {
      lowMin = Math.min(lowMin, data[j].low)
      highMax = Math.max(highMax, data[j].high)
    }
    if (highMax !== lowMin) {
      rsv[i] = ((data[i].close - lowMin) / (highMax - lowMin)) * 100
    } else {
      rsv[i] = 50
    }
  }

  const kValues: (number | null)[] = new Array(data.length).fill(null)
  const dValues: (number | null)[] = new Array(data.length).fill(null)

  // 初始值通常取 50
  kValues[n - 1] = 50
  dValues[n - 1] = 50

  for (let i = n; i < data.length; i++) {
    const rsvValue = rsv[i] ?? 50
    kValues[i] = ((m1 - 1) / m1) * (kValues[i - 1] ?? 50) + (1 / m1) * rsvValue
    dValues[i] = ((m2 - 1) / m2) * (dValues[i - 1] ?? 50) + (1 / m2) * kValues[i]!
  }

  const result: KDJData[] = []
  for (let i = n - 1; i < data.length; i++) {
    const k = kValues[i] ?? 50
    const d = dValues[i] ?? 50
    result.push({
      time: data[i].date,
      k,
      d,
      j: 3 * k - 2 * d,
    })
  }
  return result
}

/**
 * 生成 lightweight-charts 成交量数据
 * @param data K线数据数组
 * @param upColor 上涨颜色
 * @param downColor 下跌颜色
 * @returns 成交量柱状图数据数组
 */
export const calculateVolume = (
  data: KLineData[],
  upColor: string = '#ef4444',
  downColor: string = '#22c55e',
): VolumeData[] => {
  return data.map((item) => ({
    time: item.date,
    value: item.volume,
    color: item.close >= item.open ? upColor : downColor,
  }))
}
