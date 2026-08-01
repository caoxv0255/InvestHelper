import api from './request'
import type { Holding, HoldingCreate, HoldingUpdate } from '../types'

/**
 * 获取持仓列表
 * @param platform 平台筛选
 * @param assetType 资产类型筛选
 */
export const getHoldings = async (platform?: string, assetType?: string) => {
  const params: Record<string, string> = {}
  if (platform) params.platform = platform
  if (assetType) params.asset_type = assetType
  return api.get<Holding[]>('/holdings', { params })
}

/**
 * 获取单条持仓
 * @param id 持仓ID
 */
export const getHolding = async (id: number) => {
  return api.get<Holding>(`/holdings/${id}`)
}

/**
 * 创建持仓
 * @param data 持仓数据
 */
export const createHolding = async (data: HoldingCreate) => {
  return api.post<Holding>('/holdings', data)
}

/**
 * 更新持仓
 * @param id 持仓ID
 * @param data 更新数据
 */
export const updateHolding = async (id: number, data: HoldingUpdate) => {
  return api.put<Holding>(`/holdings/${id}`, data)
}

/**
 * 删除持仓
 * @param id 持仓ID
 */
export const deleteHolding = async (id: number) => {
  return api.delete(`/holdings/${id}`)
}
