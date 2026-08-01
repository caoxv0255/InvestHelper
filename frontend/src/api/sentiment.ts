import api from './request'
import type { MarketSentimentOverview } from '../types'

/**
 * 获取市场情绪仪表盘完整数据
 */
export const getMarketSentiment = async () => {
  return api.get<MarketSentimentOverview>('/sentiment/overview')
}
