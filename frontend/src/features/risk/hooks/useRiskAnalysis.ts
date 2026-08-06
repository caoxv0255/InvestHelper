/**
 * useRiskAnalysis — 风险分析领域 hook
 *
 * 单 endpoint 数据加载：data / loading / error / refresh。
 * 内部用 useAsyncResource 表达状态机。
 *
 * 返回 data 为 RiskAnalysisResult | null（兼容原 useState 语义），
 * 未加载时为 null。消费方用 data && xxx 保护。
 */
import { useCallback } from 'react'
import { useAsyncResource } from '../../../hooks'
import { getRiskAnalysis } from '../../../api/risk'
import type { RiskAnalysisResult } from '../../../types'

export interface RiskAnalysisState {
  data: RiskAnalysisResult | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRiskAnalysis(): RiskAnalysisState {
  const fetcher = useCallback(
    async (): Promise<RiskAnalysisResult> => {
      return await getRiskAnalysis()
    },
    [],
  )

  // 用第二个重载（不传 initialData），data 为 T | undefined，hook 内 ?? null 兜底
  const resource = useAsyncResource<RiskAnalysisResult>(fetcher, [])

  return {
    data: resource.data ?? null,
    loading: resource.loading,
    error: resource.error,
    refresh: resource.refetch,
  }
}