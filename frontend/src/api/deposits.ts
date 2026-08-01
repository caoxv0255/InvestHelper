import api from './request'
import type { Deposit, DepositCreate, DepositUpdate } from '../types'

/**
 * 获取定期理财列表
 * @param status 状态筛选
 */
export const getDeposits = async (status?: string) => {
  const params: Record<string, string> = {}
  if (status) params.status = status
  return api.get<Deposit[]>('/deposits', { params })
}

/**
 * 获取单条定期理财
 * @param id 定期ID
 */
export const getDeposit = async (id: number) => {
  return api.get<Deposit>(`/deposits/${id}`)
}

/**
 * 创建定期理财
 * @param data 定期数据
 */
export const createDeposit = async (data: DepositCreate) => {
  return api.post<Deposit>('/deposits', data)
}

/**
 * 更新定期理财
 * @param id 定期ID
 * @param data 更新数据
 */
export const updateDeposit = async (id: number, data: DepositUpdate) => {
  return api.put<Deposit>(`/deposits/${id}`, data)
}

/**
 * 删除定期理财
 * @param id 定期ID
 */
export const deleteDeposit = async (id: number) => {
  return api.delete(`/deposits/${id}`)
}
