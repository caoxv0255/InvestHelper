import api from './request'
import type {
  OpportunityListResponse,
  OpportunityHistoryResponse,
  Opportunity,
} from '../types'

/**
 * 获取当前活跃机会列表
 * @param limit 返回数量上限
 */
export const getOpportunities = (limit: number = 20) =>
  api.get<OpportunityListResponse>('/opportunities', { params: { limit } })

/**
 * 手动触发筛选扫描
 * 执行多维度机会筛选（板块动量 + 技术信号 + 资金流向）
 */
export const scanOpportunities = () =>
  api.post<OpportunityListResponse>('/opportunities/scan')

/**
 * 获取历史机会记录
 * @param days 查询最近 N 天的记录
 */
export const getOpportunityHistory = (days: number = 30) =>
  api.get<OpportunityHistoryResponse>('/opportunities/history', { params: { days } })

/**
 * 获取单个机会详情
 * @param id 机会记录 ID
 */
export const getOpportunityDetail = (id: number) =>
  api.get<Opportunity>(`/opportunities/${id}`)
