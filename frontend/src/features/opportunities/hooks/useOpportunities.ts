/**
 * useOpportunities — 投资机会列表领域 hook
 *
 * 封装：列表加载 + scan 触发 + 筛选状态 + scannedAt 时间戳。
 * 外部只需传 { typeFilter, minScore, limit? }，得到：
 *   { opportunities, filteredOpportunities, loading, scanning, error,
 *     scannedAt, scan(), refresh() }。
 *
 * 与 useNewsFeed 同层：内部用 useAsyncResource 表达加载状态机，
 * scan 是独立的 loading + scannedAt 状态（不会清空原 opportunities）。
 */
import { useCallback, useMemo, useState } from 'react'
import {
  getOpportunities,
  scanOpportunities,
} from '../../../api/opportunities'
import { useAsyncResource } from '../../../hooks'
import type { Opportunity } from '../../../types'

export interface OpportunityFilters {
  typeFilter: string
  minScore: number
  limit?: number
}

export interface OpportunityListState {
  /** 原始列表（未筛选） */
  opportunities: Opportunity[]
  /** 筛选后的列表（按 typeFilter + minScore 过滤） */
  filteredOpportunities: Opportunity[]
  /** 初次/刷新加载态 */
  loading: boolean
  /** scan 中（不阻塞 loading，UI 用 scanning 替代 loading 显示扫描动画） */
  scanning: boolean
  /** 加载或扫描错误 */
  error: string | null
  /** 最近一次扫描时间戳（来自后端 scanned_at） */
  scannedAt: string | null
  /** 手动触发后端 scan，扫描完成后自动刷新列表与 scannedAt */
  scan: () => Promise<void>
  /** 重新拉取当前列表（不重新 scan） */
  refresh: () => Promise<void>
}

// 暴露给 FilterPanel 共用的元数据常量
export const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'momentum', label: '板块动量' },
  { value: 'technical', label: '技术信号' },
  { value: 'fund_flow', label: '资金流向' },
] as const

export function useOpportunities(
  filters: OpportunityFilters,
): OpportunityListState {
  const { typeFilter, minScore, limit = 50 } = filters

  // 列表加载：用 useAsyncResource 第二个重载（不传 initialData），data 类型为 T | undefined
  // hook 内部用 ?? [] 兜底返回。绕开重载解析歧义（fetcher 推断丢失导致 TS 错选第二个）
  const fetcher = useCallback(
    async (): Promise<Opportunity[]> => {
      const r = await getOpportunities(limit)
      return (r.items || []) as Opportunity[]
    },
    [limit],
  )
  const resource = useAsyncResource<Opportunity[]>(fetcher, [limit])

  const [scanning, setScanning] = useState(false)
  const [scannedAt, setScannedAt] = useState<string | null>(null)

  const scan = useCallback(async () => {
    setScanning(true)
    try {
      const result = await scanOpportunities()
      resource.setData(result.items || [])
      setScannedAt(result.scanned_at)
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      throw err // 抛出由调用方决定错误展示
    } finally {
      setScanning(false)
    }
  }, [resource])

  // 筛选：useMemo 包装避免每次 render 重算。data 兜底 []
  const data = resource.data ?? []
  const filteredOpportunities = useMemo(() => {
    return data.filter((opp) => {
      if (typeFilter !== 'all' && opp.opportunity_type !== typeFilter) {
        return false
      }
      if (opp.score < minScore) {
        return false
      }
      return true
    })
  }, [data, typeFilter, minScore])

  return {
    opportunities: data,
    filteredOpportunities,
    loading: resource.loading,
    scanning,
    error: resource.error,
    scannedAt: scannedAt,
    scan,
    refresh: resource.refetch,
  }
}