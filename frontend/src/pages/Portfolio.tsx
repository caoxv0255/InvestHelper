/**
 * Portfolio 页面入口
 *
 * 状态管理 + 数据 fetch + 弹窗处理。
 * 表格 / 简单表单 / 删除确认已抽到 features/portfolio/components/；
 * 剩余 3 个 modal（止盈止损、技术信号详情、仓位建议）仍在本文件，
 * 后续可继续抽。
 */
import { useState, useEffect } from 'react'
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
import { formatDate } from '../utils/format'
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
  const [activeTab, setActiveTab] = useState<TabType>('holdings')

  // 持仓相关状态
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [holdingsLoading, setHoldingsLoading] = useState(false)
  const [holdingsError, setHoldingsError] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<string>('')
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('')

  // 技术信号相关状态
  const [signalMap, setSignalMap] = useState<Record<string, TechnicalSignal>>({})
  const [signalsLoading, setSignalsLoading] = useState(false)
  const [selectedSignal, setSelectedSignal] = useState<TechnicalSignal | null>(null)

  // 仓位建议相关状态
  const [positionSuggestions, setPositionSuggestions] = useState<PositionSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsModalVisible, setSuggestionsModalVisible] = useState(false)
  const [suggestionSummary, setSuggestionSummary] = useState<{ total_assets: number; risk_tolerance: number }>({
    total_assets: 0,
    risk_tolerance: 0.02,
  })

  // 辅助功能（信号/建议/预警）加载失败的统一展示
  const [auxiliaryError, setAuxiliaryError] = useState<string | null>(null)
  const setAuxError = (msg: string) => {
    setAuxiliaryError(msg)
    // 同时打日志方便排查
    // eslint-disable-next-line no-console
    console.warn('[auxiliary load]', msg)
  }

  // 止盈止损预警相关状态
  const [positionAlerts, setPositionAlerts] = useState<PositionAlertItem[]>([])

  // 止盈止损设置弹窗状态
  const [tpSlModalVisible, setTpSlModalVisible] = useState(false)
  const [editingTpSlHolding, setEditingTpSlHolding] = useState<Holding | null>(null)
  const [tpSlForm, setTpSlForm] = useState({
    take_profit_price: '',
    stop_loss_price: '',
  })
  const [tpSlLoading, setTpSlLoading] = useState(false)

  // 定期理财相关状态
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [depositsLoading, setDepositsLoading] = useState(false)
  const [depositsError, setDepositsError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  // 弹窗相关状态 - 持仓
  const [holdingModalVisible, setHoldingModalVisible] = useState(false)
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null)
  const [holdingForm, setHoldingForm] = useState<HoldingCreate>({
    platform: 'alipay',
    asset_type: 'fund',
    code: '',
    name: '',
    quantity: 0,
    cost_price: 0,
    current_price: null,
    take_profit_price: null,
    stop_loss_price: null,
    industry: null,
    buy_date: null,
    notes: null,
  })
  const [holdingFormErrors, setHoldingFormErrors] = useState<Record<string, string>>({})

  // 弹窗相关状态 - 定期理财
  const [depositModalVisible, setDepositModalVisible] = useState(false)
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null)
  const [depositForm, setDepositForm] = useState<DepositCreate>({
    bank: 'cmb',
    product_name: '',
    principal: 0,
    annual_rate: 0,
    start_date: '',
    maturity_date: '',
    expected_return: 0,
    status: 'active',
    notes: null,
  })
  const [depositFormErrors, setDepositFormErrors] = useState<Record<string, string>>({})

  // 删除确认弹窗
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  // ===== 数据 fetch =====

  const fetchHoldings = async () => {
    setHoldingsLoading(true)
    setHoldingsError(null)
    try {
      const data = await getHoldings(
        platformFilter || undefined,
        assetTypeFilter || undefined,
      )
      setHoldings(data)
      // 持仓加载成功后，批量拉取技术信号
      fetchSignals(data)
    } catch (err: any) {
      setHoldingsError(err.message || '加载持仓列表失败')
    } finally {
      setHoldingsLoading(false)
    }
  }

  const fetchSignals = async (targetHoldings: Holding[]) => {
    const analyzable = targetHoldings.filter(
      (h) => h.asset_type === 'stock' || h.asset_type === 'fund',
    )
    if (analyzable.length === 0) {
      setSignalMap({})
      return
    }

    setSignalsLoading(true)
    try {
      const items = analyzable.map((h) => ({
        code: h.code,
        period: 'daily' as const,
        asset_type: h.asset_type,
      }))
      const response = await batchGetSignals(items)
      const map: Record<string, TechnicalSignal> = {}
      response.results.forEach((signal) => {
        map[signal.code] = signal
      })
      setSignalMap(map)
    } catch (err: any) {
      setAuxError(`加载技术信号失败：${err?.message ?? err}`)
    } finally {
      setSignalsLoading(false)
    }
  }

  const fetchPositionSuggestions = async () => {
    setSuggestionsLoading(true)
    try {
      const data = await getPositionSuggestions()
      setPositionSuggestions(data.suggestions)
      setSuggestionSummary({
        total_assets: data.total_assets,
        risk_tolerance: data.risk_tolerance,
      })
    } catch (err: any) {
      setAuxError(`加载仓位建议失败：${err?.message ?? err}`)
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const fetchPositionAlerts = async () => {
    try {
      const data = await getPositionAlerts()
      setPositionAlerts(data.alerts)
    } catch (err: any) {
      setAuxError(`加载止盈止损预警失败：${err?.message ?? err}`)
    }
  }

  const fetchDeposits = async () => {
    setDepositsLoading(true)
    setDepositsError(null)
    try {
      const data = await getDeposits(statusFilter || undefined)
      setDeposits(data)
    } catch (err: any) {
      setDepositsError(err.message || '加载定期理财列表失败')
    } finally {
      setDepositsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'holdings') {
      fetchHoldings()
      fetchPositionSuggestions()
      fetchPositionAlerts()
    } else {
      fetchDeposits()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, platformFilter, assetTypeFilter, statusFilter])

  // ===== 持仓表单 handler =====

  const openAddHoldingModal = () => {
    setEditingHolding(null)
    setHoldingForm({
      platform: 'alipay',
      asset_type: 'fund',
      code: '',
      name: '',
      quantity: 0,
      cost_price: 0,
      current_price: null,
      take_profit_price: null,
      stop_loss_price: null,
      industry: null,
      buy_date: null,
      notes: null,
    })
    setHoldingFormErrors({})
    setHoldingModalVisible(true)
  }

  const openEditHoldingModal = (holding: Holding) => {
    setEditingHolding(holding)
    setHoldingForm({
      platform: holding.platform,
      asset_type: holding.asset_type,
      code: holding.code,
      name: holding.name,
      quantity: holding.quantity,
      cost_price: holding.cost_price,
      current_price: holding.current_price,
      take_profit_price: holding.take_profit_price,
      stop_loss_price: holding.stop_loss_price,
      industry: holding.industry,
      buy_date: holding.buy_date,
      notes: holding.notes,
    })
    setHoldingFormErrors({})
    setHoldingModalVisible(true)
  }

  const validateHoldingForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!holdingForm.platform) errors.platform = '请选择平台'
    if (!holdingForm.asset_type) errors.asset_type = '请选择资产类型'
    if (!holdingForm.code.trim()) errors.code = '请输入代码'
    if (!holdingForm.name.trim()) errors.name = '请输入名称'
    if (holdingForm.quantity <= 0) errors.quantity = '持仓数量必须大于0'
    if (holdingForm.cost_price <= 0) errors.cost_price = '成本价必须大于0'
    setHoldingFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submitHoldingForm = async () => {
    if (!validateHoldingForm()) return

    try {
      if (editingHolding) {
        await updateHolding(editingHolding.id, holdingForm)
      } else {
        await createHolding(holdingForm)
      }
      setHoldingModalVisible(false)
      fetchHoldings()
    } catch (err: any) {
      alert(err.message || '保存失败')
    }
  }

  // ===== 定期表单 handler =====

  const openAddDepositModal = () => {
    setEditingDeposit(null)
    const today = formatDate(new Date())
    setDepositForm({
      bank: 'cmb',
      product_name: '',
      principal: 0,
      annual_rate: 0,
      start_date: today,
      maturity_date: today,
      expected_return: 0,
      status: 'active',
      notes: null,
    })
    setDepositFormErrors({})
    setDepositModalVisible(true)
  }

  const openEditDepositModal = (deposit: Deposit) => {
    setEditingDeposit(deposit)
    setDepositForm({
      bank: deposit.bank,
      product_name: deposit.product_name,
      principal: deposit.principal,
      annual_rate: deposit.annual_rate,
      start_date: deposit.start_date,
      maturity_date: deposit.maturity_date,
      expected_return: deposit.expected_return,
      status: deposit.status,
      notes: deposit.notes,
    })
    setDepositFormErrors({})
    setDepositModalVisible(true)
  }

  const validateDepositForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!depositForm.bank) errors.bank = '请选择银行'
    if (!depositForm.product_name.trim()) errors.product_name = '请输入产品名称'
    if (depositForm.principal <= 0) errors.principal = '本金必须大于0'
    if (depositForm.annual_rate <= 0) errors.annual_rate = '利率必须大于0'
    if (!depositForm.start_date) errors.start_date = '请选择起息日'
    if (!depositForm.maturity_date) errors.maturity_date = '请选择到期日'
    if (depositForm.start_date && depositForm.maturity_date && depositForm.start_date >= depositForm.maturity_date) {
      errors.maturity_date = '到期日必须晚于起息日'
    }
    setDepositFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const calculateExpectedReturn = () => {
    if (depositForm.principal > 0 && depositForm.annual_rate > 0 && depositForm.start_date && depositForm.maturity_date) {
      const start = new Date(depositForm.start_date)
      const end = new Date(depositForm.maturity_date)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const expected = (depositForm.principal * depositForm.annual_rate / 100) * (days / 365)
      setDepositForm({ ...depositForm, expected_return: Math.round(expected * 100) / 100 })
    }
  }

  const submitDepositForm = async () => {
    if (!validateDepositForm()) return

    try {
      if (editingDeposit) {
        await updateDeposit(editingDeposit.id, depositForm)
      } else {
        await createDeposit(depositForm)
      }
      setDepositModalVisible(false)
      fetchDeposits()
    } catch (err: any) {
      alert(err.message || '保存失败')
    }
  }

  // ===== 删除 handler =====

  const openDeleteModal = (type: 'holding' | 'deposit', id: number, name: string) => {
    setDeleteTarget({ type, id, name })
    setDeleteModalVisible(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    try {
      if (deleteTarget.type === 'holding') {
        await deleteHolding(deleteTarget.id)
        fetchHoldings()
      } else {
        await deleteDeposit(deleteTarget.id)
        fetchDeposits()
      }
      setDeleteModalVisible(false)
      setDeleteTarget(null)
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  // ===== 止盈止损 handler =====

  const openTpSlModal = (holding: Holding) => {
    setEditingTpSlHolding(holding)
    setTpSlForm({
      take_profit_price: holding.take_profit_price?.toString() ?? '',
      stop_loss_price: holding.stop_loss_price?.toString() ?? '',
    })
    setTpSlModalVisible(true)
  }

  const autoCalculateTpSl = async () => {
    if (!editingTpSlHolding) return
    setTpSlLoading(true)
    try {
      const result: TakeProfitStopLossResult = await calculateTakeProfitStopLoss(
        editingTpSlHolding.id,
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
    if (!editingTpSlHolding) return

    const takeProfitPrice = tpSlForm.take_profit_price
      ? parseFloat(tpSlForm.take_profit_price)
      : null
    const stopLossPrice = tpSlForm.stop_loss_price
      ? parseFloat(tpSlForm.stop_loss_price)
      : null

    try {
      await updateTakeProfitStopLoss(editingTpSlHolding.id, {
        take_profit_price: takeProfitPrice,
        stop_loss_price: stopLossPrice,
      })
      setTpSlModalVisible(false)
      fetchHoldings()
      fetchPositionAlerts()
    } catch (err: any) {
      alert(err.message || '保存失败')
    }
  }

  const closeTpSlModal = () => {
    setTpSlModalVisible(false)
    setEditingTpSlHolding(null)
    setTpSlForm({ take_profit_price: '', stop_loss_price: '' })
  }

  // ===== 技术信号 modal handler =====

  const openSignalModal = (holding: Holding) => {
    const signal = signalMap[holding.code]
    if (signal) {
      setSelectedSignal(signal)
    }
  }

  const closeSignalModal = () => {
    setSelectedSignal(null)
  }

  // ===== 仓位建议 modal handler =====

  const openSuggestionsModal = () => {
    setSuggestionsModalVisible(true)
  }

  const closeSuggestionsModal = () => {
    setSuggestionsModalVisible(false)
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
          holdings={holdings}
          holdingsLoading={holdingsLoading}
          holdingsError={holdingsError}
          signalMap={signalMap}
          signalsLoading={signalsLoading}
          positionSuggestions={positionSuggestions}
          suggestionsLoading={suggestionsLoading}
          positionAlerts={positionAlerts}
          platformFilter={platformFilter}
          assetTypeFilter={assetTypeFilter}
          onPlatformFilterChange={setPlatformFilter}
          onAssetTypeFilterChange={setAssetTypeFilter}
          onRefresh={fetchHoldings}
          onOpenSuggestions={openSuggestionsModal}
          onAddHolding={openAddHoldingModal}
          onEditHolding={openEditHoldingModal}
          onDeleteHolding={(id, name) => openDeleteModal('holding', id, name)}
          onOpenTpSl={openTpSlModal}
          onOpenSignal={openSignalModal}
        />
      )}

      {/* 定期 tab */}
      {activeTab === 'deposits' && (
        <DepositTable
          deposits={deposits}
          depositsLoading={depositsLoading}
          depositsError={depositsError}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onRefresh={fetchDeposits}
          onAddDeposit={openAddDepositModal}
          onEditDeposit={openEditDepositModal}
          onDeleteDeposit={(id, name) => openDeleteModal('deposit', id, name)}
        />
      )}

      {/* 持仓表单弹窗 */}
      <HoldingFormModal
        visible={holdingModalVisible}
        editing={editingHolding}
        form={holdingForm}
        errors={holdingFormErrors}
        onChange={setHoldingForm}
        onCancel={() => setHoldingModalVisible(false)}
        onSubmit={submitHoldingForm}
      />

      {/* 定期表单弹窗 */}
      <DepositFormModal
        visible={depositModalVisible}
        editing={editingDeposit}
        form={depositForm}
        errors={depositFormErrors}
        onChange={setDepositForm}
        onCancel={() => setDepositModalVisible(false)}
        onSubmit={submitDepositForm}
        onBlurCalculate={calculateExpectedReturn}
      />

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        visible={deleteModalVisible}
        target={deleteTarget}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={confirmDelete}
      />

      {/* 技术信号详情弹窗 */}
      <SignalDetailModal
        signal={selectedSignal}
        onClose={closeSignalModal}
      />

      {/* 止盈止损设置弹窗 */}
      <TpSlModal
        visible={tpSlModalVisible}
        holding={editingTpSlHolding}
        form={tpSlForm}
        loading={tpSlLoading}
        onChange={setTpSlForm}
        onAutoCalculate={autoCalculateTpSl}
        onSubmit={submitTpSlForm}
        onClose={closeTpSlModal}
      />

      {/* 仓位建议弹窗 */}
      <SuggestionsModal
        visible={suggestionsModalVisible}
        summary={suggestionSummary}
        suggestions={positionSuggestions}
        loading={suggestionsLoading}
        onClose={closeSuggestionsModal}
      />
    </div>
  )
}

export default Portfolio