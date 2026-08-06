/**
 * usePortfolioData
 *
 * Phase 1 — 状态所有权迁移（state ownership migration）第一步。
 *
 * 范围：
 *   仅抽取 Portfolio 页面中"数据加载 + 页面筛选状态"到一个 feature hook。
 *   行为 1:1：依赖数组、skip 条件、error 处理与原页面调用 useAsyncResource 时完全一致。
 *
 * 不包含：
 *   - modal orchestration
 *   - mutation 行为（holding / deposit CRUD）
 *   - 止盈止损表单与计算
 *   - auxiliary error 暴露（仍由 page 持有）
 *
 * 设计原则：
 *   - 沿用现有 useAsyncResource 抽象（与 News 模块一致）
 *   - 不引入 React Query / SWR / 新依赖
 *   - 不改变 effect 顺序、不优化依赖数组
 *
 * 注意：
 *   本文件在 Phase 1 仅作为新增能力存在，不修改 pages/Portfolio.tsx。
 *   下一切片才会把 page 内的对应 state / useAsyncResource 调用切到本 hook。
 */

import { useState } from 'react'
import { getHoldings } from '../../../api/holdings'
import { getDeposits } from '../../../api/deposits'
import { batchGetSignals } from '../../../api/signals'
import {
  getPositionSuggestions,
  getPositionAlerts,
} from '../../../api/position'
import type {
  Holding,
  Deposit,
  TechnicalSignal,
  PositionSuggestion,
  PositionAlertItem,
} from '../../../types'
import { useAsyncResource, type AsyncResource } from '../../../hooks'

export type PortfolioTab = 'holdings' | 'deposits'

export interface PortfolioData {
  // —— 页面 UI 状态 ——
  activeTab: PortfolioTab
  setActiveTab: (tab: PortfolioTab) => void

  platformFilter: string
  setPlatformFilter: (v: string) => void
  assetTypeFilter: string
  setAssetTypeFilter: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void

  // —— 资源（与原页面 1:1 的 deps / skip） ——
  holdings: AsyncResource<Holding[]>
  signals: AsyncResource<Record<string, TechnicalSignal>>
  positionSuggestions: AsyncResource<{
    suggestions: PositionSuggestion[]
    summary: { total_assets: number; risk_tolerance: number }
  }>
  positionAlerts: AsyncResource<PositionAlertItem[]>
  deposits: AsyncResource<Deposit[]>

  // —— 横跨多资源的统一错误条（Phase 2A 配套：保持红条行为 1:1） ——
  auxiliaryError: string | null
  setAuxiliaryError: (msg: string | null) => void
}

export function usePortfolioData(): PortfolioData {
  // ===== Tab & filters =====
  const [activeTab, setActiveTab] = useState<PortfolioTab>('holdings')
  const [platformFilter, setPlatformFilter] = useState<string>('')
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // ===== Auxiliary error banner =====
  // 与原页面 setAuxError 行为一致：横跨多个资源的统一错误条 state。
  // Phase 2A 把 ownership 从 page 迁到 hook，行为 1:1：
  //   - setAuxError(msg)      → 写入并 console.warn
  //   - setAuxiliaryError(null) → 关闭（清空）
  const [auxiliaryError, setAuxiliaryErrorInternal] = useState<string | null>(null)
  const setAuxError = (msg: string) => {
    setAuxiliaryErrorInternal(msg)
    // eslint-disable-next-line no-console
    console.warn('[auxiliary load]', msg)
  }
  const setAuxiliaryError = (msg: string | null) => {
    if (msg === null) setAuxiliaryErrorInternal(null)
    else setAuxError(msg)
  }

  // ===== Holdings =====
  const holdings = useAsyncResource<Holding[]>(
    () =>
      getHoldings(
        platformFilter || undefined,
        assetTypeFilter || undefined,
      ),
    [activeTab, platformFilter, assetTypeFilter],
    { initialData: [] as Holding[], skip: activeTab !== 'holdings' },
  )

  // ===== 技术信号（依赖 holdings.data，自动跟随） =====
  const signals = useAsyncResource<Record<string, TechnicalSignal>>(
    async () => {
      const target = holdings.data ?? []
      const items = target
        .filter(
          (h: Holding) =>
            h.asset_type === 'stock' || h.asset_type === 'fund',
        )
        .map((h: Holding) => ({
          code: h.code,
          period: 'daily' as const,
          asset_type: h.asset_type,
        }))
      if (items.length === 0)
        return {} as Record<string, TechnicalSignal>
      const response = await batchGetSignals(items)
      const map: Record<string, TechnicalSignal> = {}
      response.results.forEach((s: TechnicalSignal) => {
        map[s.code] = s
      })
      return map
    },
    [holdings.data, activeTab],
    {
      initialData: {} as Record<string, TechnicalSignal>,
      skip: activeTab !== 'holdings',
      onError: (e: Error) => setAuxError(`加载技术信号失败：${e.message}`),
    },
  )

  // ===== 仓位建议 =====
  const positionSuggestions = useAsyncResource<{
    suggestions: PositionSuggestion[]
    summary: { total_assets: number; risk_tolerance: number }
  }>(
    async () => {
      const data = await getPositionSuggestions()
      return {
        suggestions: data.suggestions,
        summary: {
          total_assets: data.total_assets,
          risk_tolerance: data.risk_tolerance,
        },
      }
    },
    [activeTab],
    {
      initialData: {
        suggestions: [] as PositionSuggestion[],
        summary: { total_assets: 0, risk_tolerance: 0.02 },
      },
      skip: activeTab !== 'holdings',
      onError: (e: Error) => setAuxError(`加载仓位建议失败：${e.message}`),
    },
  )

  // ===== 止盈止损预警 =====
  const positionAlerts = useAsyncResource<PositionAlertItem[]>(
    async () => (await getPositionAlerts()).alerts,
    [activeTab],
    {
      initialData: [] as PositionAlertItem[],
      skip: activeTab !== 'holdings',
      onError: (e: Error) => setAuxError(`加载止盈止损预警失败：${e.message}`),
    },
  )

  // ===== Deposits =====
  const deposits = useAsyncResource<Deposit[]>(
    () => getDeposits(statusFilter || undefined),
    [activeTab, statusFilter],
    { initialData: [] as Deposit[], skip: activeTab !== 'deposits' },
  )

  return {
    activeTab,
    setActiveTab,
    platformFilter,
    setPlatformFilter,
    assetTypeFilter,
    setAssetTypeFilter,
    statusFilter,
    setStatusFilter,
    holdings,
    signals,
    positionSuggestions,
    positionAlerts,
    deposits,
    auxiliaryError,
    setAuxiliaryError,
  }
}
