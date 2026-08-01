import api from './request'
import type { RiskAnalysisResult } from '../types'

/**
 * 获取风险分析结果
 */
export const getRiskAnalysis = async () => {
  return api.get<RiskAnalysisResult>('/risk/analysis')
}
