import api from './request'
import type { DashboardSummary } from '../types'

/**
 * 获取仪表盘汇总数据
 */
export const getDashboardSummary = async () => {
  return api.get<DashboardSummary>('/dashboard/summary')
}
