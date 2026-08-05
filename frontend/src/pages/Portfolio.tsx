/**
 * Portfolio 页面入口
 *
 * 状态管理 + 数据 fetch + 弹窗处理。
 * 表格 / 简单表单 / 删除确认 / FormModal 已抽到 features/portfolio/components/；
 * FormModal 内部用 useForm + validate 自管状态，本页只剩"打开/关闭/提交后调 API"。
 *
 * 本地仍留的 useState：
 *   - activeTab / 3 个 filter（页面内 UI 输入）
 *   - auxiliaryError（横跨多个资源的统一错误条）
 *   - tpSlForm + tpSlLoading（TpSlModal 专有交互态）
 */
import { useState } from 'react'
import {
  getHoldings,
  createHolding,
  updateHolding,
  deleteHolding,
} from '../api/holdings'
import {
  getDeposits,
  createDeposit,
  updateDeposit,
  deleteDeposit,
} from '../api/deposits'
import { batchGetSignals } from '../api/signals'
import {
  getPositionSuggestions,
  getPositionAlerts,
  calculateTakeProfitStopLoss,
  updateTakeProfitStopLoss,
} from '../api/position'
import type {
  Holding,
  HoldingCreate,
  Deposit,
  DepositCreate,
  TechnicalSignal,
  PositionSuggestion,
  PositionAlertItem,
  TakeProfitStopLossResult,
} from '../types'
import { useAsyncResource, useModal } from '../hooks'
import { HoldingTable } from '../features/portfolio/components/HoldingTable'
import { DepositTable } from '../features/portfolio/components/DepositTable'
import { HoldingFormModal } from '../features/portfolio/components/HoldingFormModal'
import { DepositFormModal } from '../features/portfolio/components/DepositFormModal'
import {
  DeleteConfirmModal,
  type DeleteTarget,
} from '../features/portfolio/components/DeleteConfirmModal'
import { SignalDetailModal } from '../features/portfolio/components/SignalDetailModal'
import { TpSlModal } from '../features/portfolio/components/TpSlModal'
import { SuggestionsModal } from '../features/portfolio/components/SuggestionsModal'
import '../styles/Portfolio.css'

type TabType = 'holdings' | 'deposits'

const Portfolio = () => {
  // ===== Tab & filters =====
  const [activeTab, setActiveTab] = useState<TabType>('holdings')
  const [platformFilter, setPlatformFilter] = useState<string>('')
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // ===== Auxiliary error banner =====
  const [auxiliaryError, setAuxiliaryError] = useState<string | null>(null)
  const setAuxError = (msg: string) => {
    setAuxiliaryError(msg)
    // eslint-disable-next-line no-console
    console.warn('[auxiliary load]', msg)
  }

  // ===== Holdings =====
  const holdings = useAsyncResource(
    () => getHoldings(platformFilter || undefined, assetTypeFilter || undefined),
    [activeTab, platformFilter, assetTypeFilter],
    { initialData: [] as Holding[], skip: activeTab !== 'holdings' },
  )

  // ===== 技术信号（依赖 holdings.data，自动跟随） =====
  const signals = useAsyncResource(
    async () => {
      const target = holdings.data ?? []
      const items = target
        .filter((h) => h.asset_type === 'stock' || h.asset_type === 'fund')
        .map((h) => ({ code: h.code, period: 'daily' as const, asset_type: h.asset_type }))
      if (items.length === 0) return {} as Record<string, TechnicalSignal>
      const response = await batchGetSignals(items)
      const map: Record<string, TechnicalSignal> = {}
      response.results.forEach((s) => {
        map[s.code] = s
      })
      return map
    },
    [holdings.data, activeTab],
    {
      initialData: {} as Record<string, TechnicalSignal>,
      skip: activeTab !== 'holdings',
      onError: (e) => setAuxError(`加载技术信号失败：${e.message}`),
    },
  )

  // ===== 仓位建议 =====
  const positionSuggestions = useAsyncResource(
    async () => {
      const data = await getPositionSuggestions()
      return {
        suggestions: data.suggestions,
        summary: { total_assets: data.total_assets, risk_tolerance: data.risk_tolerance },
      }
    },
    [activeTab],
    {
      initialData: {
        suggestions: [] as PositionSuggestion[],
        summary: { total_assets: 0, risk_tolerance: 0.02 },
      },
      skip: activeTab !== 'holdings',
      onError: (e) => setAuxError(`加载仓位建议失败：${e.message}`),
    },
  )

  // ===== 止盈止损预警 =====
  const positionAlerts = useAsyncResource(
    async () => (await getPositionAlerts()).alerts,
    [activeTab],
    {
      initialData: [] as PositionAlertItem[],
      skip: activeTab !== 'holdings',
      onError: (e) => setAuxError(`加载止盈止损预警失败：${e.message}`),
    },
  )

  // ===== Deposits =====
  const deposits = useAsyncResource(
    () => getDeposits(statusFilter || undefined),
    [activeTab, statusFilter],
    { initialData: [] as Deposit[], skip: activeTab !== 'deposits' },
  )

  // ===== Modals =====
  const holdingModal = useModal<Holding>()
  const depositModal = useModal<Deposit>()
  const deleteModal = useModal<DeleteTarget>()
  const tpSlModal = useModal<Holding>()
  const signalModal = useModal<TechnicalSignal>()
  const suggestionsModal = useModal()

  // ===== TpSl form (TpSlModal 专有交互态) =====
  const [tpSlForm, setTpSlForm] = useState({
    take_profit_price: '',
    stop_loss_price: '',
  })
  const [tpSlLoading, setTpSlLoading] = useState(false)

  // ===== Holding CRUD =====
  const submitHoldingForm = async (values: HoldingCreate) => {
    const editing = holdingModal.data
    try {
      if (editing) {
        await updateHolding(editing.id, values)
      } else {
        await createHolding(values)
      }
      holdingModal.close()
      void holdings.refetch()
    } catch (err: any) {
      alert(err.message || '保存失败')
    }
  }

  // ===== Deposit CRUD =====
  const submitDepositForm = async (values: DepositCreate) => {
    const editing = depositModal.data
    try {
      if (editing) {
        await updateDeposit(editing.id, values)
      } else {
        await createDeposit(values)
      }
      depositModal.close()
      void deposits.refetch()
    } catch (err: any) {
      alert(err.message || '保存失败')
    }
  }

  // ===== Delete =====
  const openDeleteModal = (type: 'holding' | 'deposit', id: number, name: string) => {
    deleteModal.open({ type, id, name })
  }

  const confirmDelete = async () => {
    const target = deleteModal.data
    if (!target) return

    try {
      if (target.type === 'holding') {
        await deleteHolding(target.id)
        void holdings.refetch()
      } else {
        await deleteDeposit(target.id)
        void deposits.refetch()
      }
      deleteModal.close()
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  // ===== TpSl =====
  const openTpSlModal = (holding: Holding) => {
    setTpSlForm({
      take_profit_price: holding.take_profit_price?.toString() ?? '',
      stop_loss_price: holding.stop_loss_price?.toString() ?? '',
    })
    tpSlModal.open(holding)
  }

  const autoCalculateTpSl = async () => {
    const editing = tpSlModal.data
    if (!editing) return
    setTpSlLoading(true)
    try {
      const result: TakeProfitStopLossResult = await calculateTakeProfitStopLoss(
        editing.id,
        2.0,
      )
      setTpSlForm({
        take_profit_price: result.take_profit_price?.toString() ?? '',
        stop_loss_price: result.stop_loss_price?.toString() ?? '',
      })
    } catch (err: any) {
      alert(err.message || '自动计算失败')
    } finally {
      setTpSlLoading(false)
    }
  }

  const submitTpSlForm = async () => {
    const editing = tpSlModal.data
    if (!editing) return

    const takeProfitPrice = tpSlForm.take_profit_price
      ? parseFloat(tpSlForm.take_profit_price)
      : null
    const stopLossPrice = tpSlForm.stop_loss_price
      ? parseFloat(tpSlForm.stop_loss_price)
      : null

    try {
      await updateTakeProfitStopLoss(editing.id, {
        take_profit_price: takeProfitPrice,
        stop_loss_price: stopLossPrice,
      })
      tpSlModal.close()
      setTpSlForm({ take_profit_price: '', stop_loss_price: '' })
      void holdings.refetch()
      void positionAlerts.refetch()
    } catch (err: any) {
      alert(err.message || '保存失败')
    }
  }

  const closeTpSlModal = () => {
    tpSlModal.close()
    setTpSlForm({ take_profit_price: '', stop_loss_price: '' })
  }

  // ===== Signal & Suggestions modals =====
  const openSignalModal = (holding: Holding) => {
    const signal = signals.data?.[holding.code]
    if (signal) signalModal.open(signal)
  }

  const openSuggestionsModal = () => {
    suggestionsModal.open()
  }

  return (
    <div className="page-container">
      <h1 className="page-title">持仓管理</h1>
      {auxiliaryError && (
        <div className="aux-error-banner" role="alert">
          <span>⚠️ {auxiliaryError}</span>
          <button className="aux-error-close" onClick={() => setAuxiliaryError(null)}>×</button>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'holdings' ? 'active' : ''}`}
          onClick={() => setActiveTab('holdings')}
        >
          持仓列表
        </button>
        <button
          className={`tab-btn ${activeTab === 'deposits' ? 'active' : ''}`}
          onClick={() => setActiveTab('deposits')}
        >
          定期理财
        </button>
      </div>

      {/* 持仓 tab */}
      {activeTab === 'holdings' && (
        <HoldingTable
          holdings={holdings.data ?? []}
          holdingsLoading={holdings.loading}
          holdingsError={holdings.error}
          signalMap={signals.data ?? {}}
          signalsLoading={signals.loading}
          positionSuggestions={positionSuggestions.data?.suggestions ?? []}
          suggestionsLoading={positionSuggestions.loading}
          positionAlerts={positionAlerts.data ?? []}
          platformFilter={platformFilter}
          assetTypeFilter={assetTypeFilter}
          onPlatformFilterChange={setPlatformFilter}
          onAssetTypeFilterChange={setAssetTypeFilter}
          onRefresh={() => void holdings.refetch()}
          onOpenSuggestions={openSuggestionsModal}
          onAddHolding={() => holdingModal.open()}
          onEditHolding={(holding) => holdingModal.open(holding)}
          onDeleteHolding={(id, name) => openDeleteModal('holding', id, name)}
          onOpenTpSl={openTpSlModal}
          onOpenSignal={openSignalModal}
        />
      )}

      {/* 定期 tab */}
      {activeTab === 'deposits' && (
        <DepositTable
          deposits={deposits.data ?? []}
          depositsLoading={deposits.loading}
          depositsError={deposits.error}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onRefresh={() => void deposits.refetch()}
          onAddDeposit={() => depositModal.open()}
          onEditDeposit={(deposit) => depositModal.open(deposit)}
          onDeleteDeposit={(id, name) => openDeleteModal('deposit', id, name)}
        />
      )}

      {/* 持仓表单弹窗 */}
      <HoldingFormModal
        visible={holdingModal.visible}
        editing={holdingModal.data}
        onCancel={holdingModal.close}
        onSubmit={submitHoldingForm}
      />

      {/* 定期表单弹窗 */}
      <DepositFormModal
        visible={depositModal.visible}
        editing={depositModal.data}
        onCancel={depositModal.close}
        onSubmit={submitDepositForm}
      />

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        visible={deleteModal.visible}
        target={deleteModal.data}
        onCancel={deleteModal.close}
        onConfirm={() => void confirmDelete()}
      />

      {/* 技术信号详情弹窗 */}
      <SignalDetailModal
        signal={signalModal.data}
        onClose={signalModal.close}
      />

      {/* 止盈止损设置弹窗 */}
      <TpSlModal
        visible={tpSlModal.visible}
        holding={tpSlModal.data}
        form={tpSlForm}
        loading={tpSlLoading}
        onChange={setTpSlForm}
        onAutoCalculate={() => void autoCalculateTpSl()}
        onSubmit={() => void submitTpSlForm()}
        onClose={closeTpSlModal}
      />

      {/* 仓位建议弹窗 */}
      <SuggestionsModal
        visible={suggestionsModal.visible}
        summary={positionSuggestions.data?.summary ?? { total_assets: 0, risk_tolerance: 0.02 }}
        suggestions={positionSuggestions.data?.suggestions ?? []}
        loading={positionSuggestions.loading}
        onClose={suggestionsModal.close}
      />
    </div>
  )
}

export default Portfolio