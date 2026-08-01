import api from './request'
import type { Period, StockSearchResult, KLineData } from '../types'

export interface MarketBar extends KLineData {}

export interface MarketKlineResponse {
  code: string
  name: string
  klines: MarketBar[]
}

export interface StockSearchResponse {
  list: StockSearchResult[]
}

/**
 * 获取指定标的、指定周期的 K 线数据
 * @param code 股票/基金代码
 * @param period 周期：daily / weekly / 60min / 30min / 15min / 5min
 * @param assetType 资产类型
 */
export const getKline = (
  code: string,
  period: Period,
  assetType: 'stock' | 'fund' | 'index' = 'stock',
) =>
  api.get<MarketKlineResponse>('/market/kline', {
    params: { code, asset_type: assetType, period },
  })

/**
 * 获取日 K 线（兼容旧接口）
 * @param code 股票/基金代码
 * @param assetType 资产类型
 */
export const getDailyKline = (code: string, assetType: 'stock' | 'fund' | 'index' = 'stock') =>
  getKline(code, 'daily', assetType)

/**
 * 根据关键字搜索股票/基金
 * @param keyword 代码或名称
 */
export const searchStocks = (keyword: string) =>
  api.get<StockSearchResponse>('/market/search', { params: { keyword } })
