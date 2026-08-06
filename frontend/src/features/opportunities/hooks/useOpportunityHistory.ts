/**
 * useOpportunityHistory — 历史机会领域 hook
 *
 * 封装：lazy 加载 + 折叠状态 + 按日期分组。
 * 外部只需传 days?，得到：
 *   { history, groupedHistory, loading, error, expanded, toggle(), refresh() }。
 *
 * 行为：
 * - 初始 expanded=false，不发请求（useAsyncResource skip）
 * - toggle() 第一次展开时自动触发加载（不依赖外部 effect）
 * - 折叠后保留数据，再次展开不重拉（除非显式 refresh）
 * - 按 discovered_date 分组，date 为空的归入 '未知日期'
 */
import { useCallback, useMemo, useState } from 'react'
import { getOpportunityHistory } from '../../../api/opportunities'
import { useAsyncResource } from '../../../hooks'
import type { Opportunity } from '../../../types'

export interface OpportunityHistoryState {
  history: Opportunity[]
  groupedHistory: Record<string, Opportunity[]>
  loading: boolean
  error: string | null
  expanded: boolean
  /** 切换展开；首次展开时若历史为空则触发加载 */
  toggle: () => void
  /** 强制刷新（绕过 skip 缓存） */
  refresh: () => Promise<void>
}

export function useOpportunityHistory(
  days: number = 30,
): OpportunityHistoryState {
  const [expanded, setExpanded] = useState(false)

  const fetcher = useCallback(
    async (): Promise<Opportunity[]> => {
      const r = await getOpportunityHistory(days)
      return (r.items || []) as Opportunity[]
    },
    [days],
  )

  // 用第二个重载（不传 initialData），data 为 T | undefined，hook 内用 ?? [] 兜底
  const resource = useAsyncResource<Opportunity[]>(fetcher, [days], {
    skip: !expanded,
  })

  // 首次展开触发加载：监听 expanded，从 false → true 且无数据时 refetch
  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      const current = resource.data ?? []
      if (next && current.length === 0 && !resource.loading) {
        void resource.refetch()
      }
      return next
    })
  }, [resource])

  const data = resource.data ?? []
  const groupedHistory = useMemo(() => {
    const groups: Record<string, Opportunity[]> = {}
    data.forEach((opp) => {
      const dateKey = opp.discovered_date || '未知日期'
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(opp)
    })
    return groups
  }, [data])

  return {
    history: data,
    groupedHistory,
    loading: resource.loading,
    error: resource.error,
    expanded,
    toggle,
    refresh: resource.refetch,
  }
}