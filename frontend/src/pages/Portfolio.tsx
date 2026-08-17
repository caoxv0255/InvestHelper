/**
 * Portfolio 页面入口 — Phase C (Portfolio migration)
 *
 * State ownership + data fetch + modal handlers unchanged.
 * Page chrome migrated: <div.page-container> + <h1.page-title> →
 * <PageHeader> primitive.
 *
 * State summary:
 *   - activeTab / 3 filters — usePortfolioData owns
 *   - auxiliaryError — usePortfolioData owns
 *   - tpSlForm / tpSlLoading — TpSlModal interaction state
 *   - 4 submitting flags — page-owned, passed to modals as props
 */
import { useState } from 'react'
import {
  calculateTakeProfitStopLoss,
  updateTakeProfitStopLoss,
} from '../api/position'
import type {
  Holding,
  HoldingCreate,
  Deposit,
  DepositCreate,
  TechnicalSignal,
  TakeProfitStopLossResult,
} from '../types'
import { useToast } from '../components/Toast'
import { useModal, useDocumentTitle } from '../hooks'
import { usePortfolioData } from '../features/portfolio/hooks/usePortfolioData'
import { usePortfolioActions } from '../features/portfolio/hooks/usePortfolioActions'
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
import { PageHeader } from '../components/ui/PageHeader'
import '../styles/Portfolio.css'

const Portfolio = () => {
  // ===== Document title (browser tab) =====
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _title = '持仓管理'
  useDocumentTitle(_title)

  // ===== Data ownership (Phase 2A) =====
  const {
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
  } = usePortfolioData()

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
  // ===== 持仓表单 submitting state =====
  const [holdingSubmitting, setHoldingSubmitting] = useState(false)
  // ===== 定期表单 submitting state =====
  const [depositSubmitting, setDepositSubmitting] = useState(false)
  // ===== 删除确认 submitting state =====
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const toast = useToast()
  // ===== Action ownership (Phase 2B) =====
  const actions = usePortfolioActions({
    refetchHoldings: holdings.refetch,
    refetchDeposits: deposits.refetch,
    closeHoldingModal: holdingModal.close,
    closeDepositModal: depositModal.close,
    closeDeleteModal: deleteModal.close,
    onError: (msg) => toast.show(msg, 'error'),
    onSuccess: (msg) => toast.show(msg, 'success'),
  })

  // thin wrappers — 保持 JSX 现有 onSubmit/onConfirm 签名 1:1
  const submitHoldingForm = async (values: HoldingCreate) => {
    if (holdingSubmitting) return
    setHoldingSubmitting(true)
    try {
      await actions.submitHoldingForm(values, holdingModal.data)
    } finally {
      setHoldingSubmitting(false)
    }
  }
  const submitDepositForm = async (values: DepositCreate) => {
    if (depositSubmitting) return
    setDepositSubmitting(true)
    try {
      await actions.submitDepositForm(values, depositModal.data)
    } finally {
      setDepositSubmitting(false)
    }
  }
  const confirmDelete = async () => {
    if (deleteSubmitting) return
    setDeleteSubmitting(true)
    try {
      await actions.confirmDelete(deleteModal.data)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // openDeleteModal 仍是 page 业务
  const openDeleteModal = (type: 'holding' | 'deposit', id: number, name: string) => {
    deleteModal.open({ type, id, name })
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
      toast.show(err.message || '自动计算失败', 'error')
    } finally {
      setTpSlLoading(false)
    }
  }

  const submitTpSlForm = async () => {
    const editing = tpSlModal.data
    if (!editing) return
    if (tpSlLoading) return

    const takeProfitPrice = tpSlForm.take_profit_price
      ? parseFloat(tpSlForm.take_profit_price)
      : null
    const stopLossPrice = tpSlForm.stop_loss_price
      ? parseFloat(tpSlForm.stop_loss_price)
      : null

    setTpSlLoading(true)
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
      toast.show(err.message || '保存失败', 'error')
    } finally {
      setTpSlLoading(false)
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
    <>
      <PageHeader title="持仓管理" />

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
        submitting={holdingSubmitting}
        onCancel={holdingModal.close}
        onSubmit={submitHoldingForm}
      />

      {/* 定期表单弹窗 */}
      <DepositFormModal
        visible={depositModal.visible}
        editing={depositModal.data}
        submitting={depositSubmitting}
        onCancel={depositModal.close}
        onSubmit={submitDepositForm}
      />

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        visible={deleteModal.visible}
        target={deleteModal.data}
        submitting={deleteSubmitting}
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
    </>
  )
}

export default Portfolio
