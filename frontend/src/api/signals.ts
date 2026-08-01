import api from './request'
import type { TechnicalSignal, SignalBatchItem, SignalBatchResponse } from '../types'

/**
 * 获取单只标的的技术信号
 * @param code 标的代码
 * @param period 周期，默认 daily
 * @param assetType 资产类型，默认 stock
 */
export const getSignal = async (
  code: string,
  period: string = 'daily',
  assetType: string = 'stock',
) => {
  return api.get<TechnicalSignal>(`/signals/${encodeURIComponent(code)}`, {
    params: { period, asset_type: assetType },
  })
}

/**
 * 批量获取技术信号
 * @param items 标的列表
 */
export const batchGetSignals = async (items: SignalBatchItem[]) => {
  return api.post<SignalBatchResponse>('/signals/batch', { items })
}
