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
import { SignalBadgeFromResult } from '../components/SignalBadge'
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
import { formatCurrency, formatPercent, formatDate } from '../utils/format'
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
  const [signalModalVisible, setSignalModalVisible] = useState(false)

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
  const _setAuxError = (msg: string) => {
    setAuxiliaryError(msg)
    // 同时打日志方便排查
    // eslint-disable-next-line no-console
    console.warn('[auxiliary load]', msg)
  }

  // 止盈止损预警相关状态
  const [positionAlerts, setPositionAlerts] = useState<PositionAlertItem[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)

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
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'holding' | 'deposit'; id: number; name: string } | null>(null)

  // 加载持仓列表
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

  // 批量加载持仓对应的技术信号（仅股票/基金）
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
      _setAuxError(`加载技术信号失败：${err?.message ?? err}`)
    } finally {
      setSignalsLoading(false)
    }
  }

  // 加载仓位建议
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
      _setAuxError(`加载仓位建议失败：${err?.message ?? err}`)
    } finally {
      setSuggestionsLoading(false)
    }
  }

  // 加载止盈止损预警
  const fetchPositionAlerts = async () => {
    setAlertsLoading(true)
    try {
      const data = await getPositionAlerts()
      setPositionAlerts(data.alerts)
    } catch (err: any) {
      _setAuxError(`加载止盈止损预警失败：${err?.message ?? err}`)
    } finally {
      setAlertsLoading(false)
    }
  }

  // 加载定期理财列表
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
  }, [activeTab, platformFilter, assetTypeFilter, statusFilter])

  // 计算持仓收益
  const calculateProfit = (holding: Holding) => {
    if (!holding.current_price) return 0
    return (holding.current_price - holding.cost_price) * holding.quantity
  }

  // 计算持仓收益率
  const calculateProfitPercent = (holding: Holding) => {
    if (!holding.current_price || holding.cost_price === 0) return 0
    return ((holding.current_price - holding.cost_price) / holding.cost_price) * 100
  }

  // 计算持仓市值
  const calculateMarketValue = (holding: Holding) => {
    if (!holding.current_price) return holding.cost_price * holding.quantity
    return holding.current_price * holding.quantity
  }

  // 计算剩余天数
  const getRemainingDays = (maturityDate: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const maturity = new Date(maturityDate)
    maturity.setHours(0, 0, 0, 0)
    const diff = maturity.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  // 获取平台标签样式
  const getPlatformLabel = (platform: string) => {
    const labels: Record<string, { text: string; className: string }> = {
      alipay: { text: '支付宝', className: 'platform-tag alipay' },
      cmb: { text: '招行', className: 'platform-tag cmb' },
      ths: { text: '同花顺', className: 'platform-tag ths' },
    }
    return labels[platform] || { text: platform, className: 'platform-tag' }
  }

  // 获取资产类型标签
  const getAssetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      fund: '基金',
      stock: '股票',
      deposit: '定期理财',
    }
    return labels[type] || type
  }

  // 获取状态标签
  const getStatusLabel = (status: string) => {
    const labels: Record<string, { text: string; className: string }> = {
      active: { text: '持有中', className: 'status-tag active' },
      matured: { text: '已到期', className: 'status-tag matured' },
    }
    return labels[status] || { text: status, className: 'status-tag' }
  }

  // 根据持仓ID查找预警信息
  const getAlertByHoldingId = (holdingId: number) => {
    return positionAlerts.find((alert) => alert.holding_id === holdingId)
  }

  // 打开仓位建议弹窗
  const openSuggestionsModal = () => {
    setSuggestionsModalVisible(true)
  }

  // 关闭仓位建议弹窗
  const closeSuggestionsModal = () => {
    setSuggestionsModalVisible(false)
  }

  // 打开止盈止损设置弹窗
  const openTpSlModal = async (holding: Holding) => {
    setEditingTpSlHolding(holding)
    setTpSlForm({
      take_profit_price: holding.take_profit_price?.toString() ?? '',
      stop_loss_price: holding.stop_loss_price?.toString() ?? '',
    })
    setTpSlModalVisible(true)
  }

  // 自动计算止盈止损
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

  // 提交止盈止损设置
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

  // 关闭止盈止损设置弹窗
  const closeTpSlModal = () => {
    setTpSlModalVisible(false)
    setEditingTpSlHolding(null)
    setTpSlForm({ take_profit_price: '', stop_loss_price: '' })
  }

  // 打开技术信号详情弹窗
  const openSignalModal = (holding: Holding) => {
    const signal = signalMap[holding.code]
    if (signal) {
      setSelectedSignal(signal)
      setSignalModalVisible(true)
    }
  }

  // 关闭技术信号详情弹窗
  const closeSignalModal = () => {
    setSignalModalVisible(false)
    setSelectedSignal(null)
  }

  // 打开添加持仓弹窗
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

  // 打开编辑持仓弹窗
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

  // 验证持仓表单
  const validateHoldingForm = () => {
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

  // 提交持仓表单
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

  // 打开添加定期理财弹窗
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

  // 打开编辑定期理财弹窗
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

  // 验证定期理财表单
  const validateDepositForm = () => {
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

  // 自动计算预期收益
  const calculateExpectedReturn = () => {
    if (depositForm.principal > 0 && depositForm.annual_rate > 0 && depositForm.start_date && depositForm.maturity_date) {
      const start = new Date(depositForm.start_date)
      const end = new Date(depositForm.maturity_date)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const expected = (depositForm.principal * depositForm.annual_rate / 100) * (days / 365)
      setDepositForm({ ...depositForm, expected_return: Math.round(expected * 100) / 100 })
    }
  }

  // 提交定期理财表单
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

  // 打开删除确认弹窗
  const openDeleteModal = (type: 'holding' | 'deposit', id: number, name: string) => {
    setDeleteTarget({ type, id, name })
    setDeleteModalVisible(true)
  }

  // 确认删除
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

      {/* 持仓列表 */}
      {activeTab === 'holdings' && (
        <div className="tab-content">
          {/* 筛选和操作栏 */}
          <div className="filter-bar">
            <div className="filter-group">
              <label className="filter-label">平台：</label>
              <select
                className="filter-select"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <option value="">全部</option>
                <option value="alipay">支付宝</option>
                <option value="cmb">招行</option>
                <option value="ths">同花顺</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">资产类型：</label>
              <select
                className="filter-select"
                value={assetTypeFilter}
                onChange={(e) => setAssetTypeFilter(e.target.value)}
              >
                <option value="">全部</option>
                <option value="fund">基金</option>
                <option value="stock">股票</option>
                <option value="deposit">定期理财</option>
              </select>
            </div>
            <div className="filter-spacer"></div>
            <button
              className="btn btn-secondary"
              onClick={openSuggestionsModal}
              disabled={suggestionsLoading}
            >
              {suggestionsLoading ? '计算中...' : '仓位建议'}
            </button>
            <button className="btn btn-primary" onClick={openAddHoldingModal}>
              + 添加持仓
            </button>
          </div>

          {/* 止盈止损预警 */}
          {activeTab === 'holdings' && !alertsLoading && positionAlerts.length > 0 && (
            <div className="alert-banner">
              <div className="alert-banner-title">⚠ 止盈止损预警</div>
              <ul className="alert-banner-list">
                {positionAlerts.map((alert) => (
                  <li key={alert.holding_id}>{alert.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 加载状态 */}
          {holdingsLoading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <span>加载中...</span>
            </div>
          )}

          {/* 错误提示 */}
          {holdingsError && (
            <div className="error-message">
              {holdingsError}
              <button className="btn-link" onClick={fetchHoldings}>重试</button>
            </div>
          )}

          {/* 持仓表格 */}
          {!holdingsLoading && !holdingsError && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>平台</th>
                    <th>资产类型</th>
                    <th>代码</th>
                    <th>名称</th>
                    <th className="text-right">持仓数量</th>
                    <th className="text-right">成本价</th>
                    <th className="text-right">当前价</th>
                    <th className="text-right">市值</th>
                    <th className="text-right">收益</th>
                    <th className="text-right">收益率</th>
                    <th className="text-center">技术信号</th>
                    <th className="text-center">建议仓位</th>
                    <th className="text-center">止盈/止损</th>
                    <th className="text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="empty-cell">
                        暂无持仓数据，点击"添加持仓"开始记录
                      </td>
                    </tr>
                  ) : (
                    holdings.map((holding) => {
                      const profit = calculateProfit(holding)
                      const profitPercent = calculateProfitPercent(holding)
                      const marketValue = calculateMarketValue(holding)
                      const platformInfo = getPlatformLabel(holding.platform)
                      const isPositive = profit >= 0
                      const suggestion = positionSuggestions.find(
                        (s) => s.holding_id === holding.id,
                      )
                      const alert = getAlertByHoldingId(holding.id)
                      const rowClassName = alert ? 'row-alert' : ''

                      return (
                        <tr key={holding.id} className={rowClassName}>
                          <td>
                            <span className={platformInfo.className}>
                              {platformInfo.text}
                            </span>
                          </td>
                          <td>{getAssetTypeLabel(holding.asset_type)}</td>
                          <td className="code-cell">{holding.code}</td>
                          <td className="name-cell">{holding.name}</td>
                          <td className="text-right">{holding.quantity.toFixed(2)}</td>
                          <td className="text-right">{holding.cost_price.toFixed(4)}</td>
                          <td className="text-right">
                            {holding.current_price ? holding.current_price.toFixed(4) : '-'}
                          </td>
                          <td className="text-right">{formatCurrency(marketValue)}</td>
                          <td className={`text-right ${isPositive ? 'profit-positive' : 'profit-negative'}`}>
                            {isPositive ? '+' : ''}{formatCurrency(profit)}
                          </td>
                          <td className={`text-right ${isPositive ? 'profit-positive' : 'profit-negative'}`}>
                            {formatPercent(profitPercent)}
                          </td>
                          <td className="text-center">
                            {signalsLoading && !signalMap[holding.code] ? (
                              <span className="signal-badge neutral small">加载中</span>
                            ) : (
                              <SignalBadgeFromResult
                                signal={signalMap[holding.code]}
                                clickable={!!signalMap[holding.code]}
                                onClick={() => openSignalModal(holding)}
                                size="small"
                              />
                            )}
                          </td>
                          <td className="text-center">
                            {suggestionsLoading || !suggestion ? (
                              <span className="text-muted">-</span>
                            ) : (
                              <span
                                className="signal-badge small"
                                title={suggestion.reason}
                              >
                                {formatPercent(suggestion.suggested_ratio * 100)}
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            <button
                              className="btn-link btn-edit"
                              onClick={() => openTpSlModal(holding)}
                              title={alert ? alert.message : '设置止盈止损'}
                            >
                              {alert ? (
                                <span className="text-alert">已触发</span>
                              ) : holding.take_profit_price || holding.stop_loss_price ? (
                                '已设置'
                              ) : (
                                '未设置'
                              )}
                            </button>
                          </td>
                          <td className="text-center">
                            <button
                              className="btn-link btn-edit"
                              onClick={() => openEditHoldingModal(holding)}
                            >
                              编辑
                            </button>
                            <button
                              className="btn-link btn-delete"
                              onClick={() => openDeleteModal('holding', holding.id, holding.name)}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 定期理财列表 */}
      {activeTab === 'deposits' && (
        <div className="tab-content">
          {/* 筛选和操作栏 */}
          <div className="filter-bar">
            <div className="filter-group">
              <label className="filter-label">状态：</label>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">全部</option>
                <option value="active">持有中</option>
                <option value="matured">已到期</option>
              </select>
            </div>
            <div className="filter-spacer"></div>
            <button className="btn btn-primary" onClick={openAddDepositModal}>
              + 添加定期
            </button>
          </div>

          {/* 加载状态 */}
          {depositsLoading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <span>加载中...</span>
            </div>
          )}

          {/* 错误提示 */}
          {depositsError && (
            <div className="error-message">
              {depositsError}
              <button className="btn-link" onClick={fetchDeposits}>重试</button>
            </div>
          )}

          {/* 定期理财表格 */}
          {!depositsLoading && !depositsError && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>产品名称</th>
                    <th className="text-right">本金</th>
                    <th className="text-right">利率</th>
                    <th>起息日</th>
                    <th>到期日</th>
                    <th className="text-right">预期收益</th>
                    <th>状态</th>
                    <th className="text-right">剩余天数</th>
                    <th className="text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="empty-cell">
                        暂无定期理财数据，点击"添加定期"开始记录
                      </td>
                    </tr>
                  ) : (
                    deposits.map((deposit) => {
                      const remainingDays = getRemainingDays(deposit.maturity_date)
                      const statusInfo = getStatusLabel(deposit.status)
                      let rowClassName = ''
                      if (deposit.status === 'matured' || remainingDays < 0) {
                        rowClassName = 'row-matured'
                      } else if (remainingDays <= 7) {
                        rowClassName = 'row-warning'
                      }

                      return (
                        <tr key={deposit.id} className={rowClassName}>
                          <td className="name-cell">{deposit.product_name}</td>
                          <td className="text-right">{formatCurrency(deposit.principal)}</td>
                          <td className="text-right">{deposit.annual_rate.toFixed(2)}%</td>
                          <td>{formatDate(deposit.start_date)}</td>
                          <td>{formatDate(deposit.maturity_date)}</td>
                          <td className="text-right profit-positive">
                            +{formatCurrency(deposit.expected_return)}
                          </td>
                          <td>
                            <span className={statusInfo.className}>
                              {statusInfo.text}
                            </span>
                          </td>
                          <td className="text-right">
                            {remainingDays < 0 ? '已到期' : `${remainingDays}天`}
                          </td>
                          <td className="text-center">
                            <button
                              className="btn-link btn-edit"
                              onClick={() => openEditDepositModal(deposit)}
                            >
                              编辑
                            </button>
                            <button
                              className="btn-link btn-delete"
                              onClick={() => openDeleteModal('deposit', deposit.id, deposit.product_name)}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 持仓表单弹窗 */}
      {holdingModalVisible && (
        <div className="modal-overlay" onClick={() => setHoldingModalVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingHolding ? '编辑持仓' : '添加持仓'}</h3>
              <button className="modal-close" onClick={() => setHoldingModalVisible(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">平台 <span className="required">*</span></label>
                  <select
                    className="form-input"
                    value={holdingForm.platform}
                    onChange={(e) => setHoldingForm({ ...holdingForm, platform: e.target.value })}
                  >
                    <option value="alipay">支付宝</option>
                    <option value="cmb">招行</option>
                    <option value="ths">同花顺</option>
                  </select>
                  {holdingFormErrors.platform && <div className="form-error">{holdingFormErrors.platform}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">资产类型 <span className="required">*</span></label>
                  <select
                    className="form-input"
                    value={holdingForm.asset_type}
                    onChange={(e) => setHoldingForm({ ...holdingForm, asset_type: e.target.value })}
                  >
                    <option value="fund">基金</option>
                    <option value="stock">股票</option>
                    <option value="deposit">定期理财</option>
                  </select>
                  {holdingFormErrors.asset_type && <div className="form-error">{holdingFormErrors.asset_type}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">代码 <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={holdingForm.code}
                    onChange={(e) => setHoldingForm({ ...holdingForm, code: e.target.value })}
                    placeholder="请输入标的代码"
                  />
                  {holdingFormErrors.code && <div className="form-error">{holdingFormErrors.code}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">名称 <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={holdingForm.name}
                    onChange={(e) => setHoldingForm({ ...holdingForm, name: e.target.value })}
                    placeholder="请输入标的名称"
                  />
                  {holdingFormErrors.name && <div className="form-error">{holdingFormErrors.name}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">持仓数量 <span className="required">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={holdingForm.quantity}
                    onChange={(e) => setHoldingForm({ ...holdingForm, quantity: parseFloat(e.target.value) || 0 })}
                  />
                  {holdingFormErrors.quantity && <div className="form-error">{holdingFormErrors.quantity}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">成本价 <span className="required">*</span></label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={holdingForm.cost_price}
                    onChange={(e) => setHoldingForm({ ...holdingForm, cost_price: parseFloat(e.target.value) || 0 })}
                  />
                  {holdingFormErrors.cost_price && <div className="form-error">{holdingFormErrors.cost_price}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">当前价</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={holdingForm.current_price ?? ''}
                    onChange={(e) => setHoldingForm({ ...holdingForm, current_price: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="可选"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">行业</label>
                  <input
                    type="text"
                    className="form-input"
                    value={holdingForm.industry ?? ''}
                    onChange={(e) => setHoldingForm({ ...holdingForm, industry: e.target.value || null })}
                    placeholder="可选"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">买入日期</label>
                  <input
                    type="date"
                    className="form-input"
                    value={holdingForm.buy_date ?? ''}
                    onChange={(e) => setHoldingForm({ ...holdingForm, buy_date: e.target.value || null })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">备注</label>
                  <input
                    type="text"
                    className="form-input"
                    value={holdingForm.notes ?? ''}
                    onChange={(e) => setHoldingForm({ ...holdingForm, notes: e.target.value || null })}
                    placeholder="可选"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setHoldingModalVisible(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={submitHoldingForm}>
                {editingHolding ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 定期理财表单弹窗 */}
      {depositModalVisible && (
        <div className="modal-overlay" onClick={() => setDepositModalVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingDeposit ? '编辑定期理财' : '添加定期理财'}</h3>
              <button className="modal-close" onClick={() => setDepositModalVisible(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">银行 <span className="required">*</span></label>
                  <select
                    className="form-input"
                    value={depositForm.bank}
                    onChange={(e) => setDepositForm({ ...depositForm, bank: e.target.value })}
                  >
                    <option value="cmb">招商银行</option>
                    <option value="icbc">工商银行</option>
                    <option value="ccb">建设银行</option>
                    <option value="abc">农业银行</option>
                    <option value="boc">中国银行</option>
                  </select>
                  {depositFormErrors.bank && <div className="form-error">{depositFormErrors.bank}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">产品名称 <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={depositForm.product_name}
                    onChange={(e) => setDepositForm({ ...depositForm, product_name: e.target.value })}
                    placeholder="请输入产品名称"
                  />
                  {depositFormErrors.product_name && <div className="form-error">{depositFormErrors.product_name}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">本金 <span className="required">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={depositForm.principal}
                    onChange={(e) => {
                      const newForm = { ...depositForm, principal: parseFloat(e.target.value) || 0 }
                      setDepositForm(newForm)
                    }}
                    onBlur={calculateExpectedReturn}
                  />
                  {depositFormErrors.principal && <div className="form-error">{depositFormErrors.principal}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">年化利率(%) <span className="required">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={depositForm.annual_rate}
                    onChange={(e) => {
                      const newForm = { ...depositForm, annual_rate: parseFloat(e.target.value) || 0 }
                      setDepositForm(newForm)
                    }}
                    onBlur={calculateExpectedReturn}
                  />
                  {depositFormErrors.annual_rate && <div className="form-error">{depositFormErrors.annual_rate}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">起息日 <span className="required">*</span></label>
                  <input
                    type="date"
                    className="form-input"
                    value={depositForm.start_date}
                    onChange={(e) => {
                      const newForm = { ...depositForm, start_date: e.target.value }
                      setDepositForm(newForm)
                    }}
                    onBlur={calculateExpectedReturn}
                  />
                  {depositFormErrors.start_date && <div className="form-error">{depositFormErrors.start_date}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">到期日 <span className="required">*</span></label>
                  <input
                    type="date"
                    className="form-input"
                    value={depositForm.maturity_date}
                    onChange={(e) => {
                      const newForm = { ...depositForm, maturity_date: e.target.value }
                      setDepositForm(newForm)
                    }}
                    onBlur={calculateExpectedReturn}
                  />
                  {depositFormErrors.maturity_date && <div className="form-error">{depositFormErrors.maturity_date}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">预期收益</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={depositForm.expected_return}
                    onChange={(e) => setDepositForm({ ...depositForm, expected_return: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">状态</label>
                  <select
                    className="form-input"
                    value={depositForm.status}
                    onChange={(e) => setDepositForm({ ...depositForm, status: e.target.value })}
                  >
                    <option value="active">持有中</option>
                    <option value="matured">已到期</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group form-group-full">
                  <label className="form-label">备注</label>
                  <input
                    type="text"
                    className="form-input"
                    value={depositForm.notes ?? ''}
                    onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value || null })}
                    placeholder="可选"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDepositModalVisible(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={submitDepositForm}>
                {editingDeposit ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteModalVisible && (
        <div className="modal-overlay" onClick={() => setDeleteModalVisible(false)}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>确认删除</h3>
              <button className="modal-close" onClick={() => setDeleteModalVisible(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>确定要删除「{deleteTarget?.name}」吗？</p>
              <p className="text-warning">此操作不可恢复，请谨慎操作。</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteModalVisible(false)}>
                取消
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 技术信号详情弹窗 */}
      {signalModalVisible && selectedSignal && (
        <div className="modal-overlay" onClick={closeSignalModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedSignal.name || selectedSignal.code} 技术信号
                <span style={{ marginLeft: '0.75rem' }}>
                  <SignalBadgeFromResult signal={selectedSignal} size="medium" />
                </span>
              </h3>
              <button className="modal-close" onClick={closeSignalModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="signal-detail-section">
                <div className="signal-detail-title">综合评分</div>
                <div className="signal-detail-score">
                  <span>{selectedSignal.score}</span>
                  <div className="signal-score-bar">
                    <div
                      className="signal-score-fill"
                      style={{ width: `${selectedSignal.score}%` }}
                    />
                  </div>
                </div>
                <div className="signal-detail-title">研判结论</div>
                <ul className="signal-detail-list">
                  {selectedSignal.reasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>

              <div className="signal-detail-section">
                <div className="signal-detail-title">分项信号</div>
                {selectedSignal.signals.map((item) => (
                  <div key={item.category} style={{ marginBottom: '0.75rem' }}>
                    <strong>{item.category}</strong>
                    {!item.valid ? (
                      <div className="signal-detail-empty">{item.reason}</div>
                    ) : item.signals.length === 0 ? (
                      <div className="signal-detail-empty">暂无明确信号</div>
                    ) : (
                      <ul className="signal-detail-list">
                        {item.signals.map((signal, idx) => (
                          <li key={idx}>{signal}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              {selectedSignal.error && (
                <div className="signal-detail-section">
                  <div className="signal-detail-title">异常信息</div>
                  <div className="signal-detail-empty">{selectedSignal.error}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeSignalModal}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 止盈止损设置弹窗 */}
      {tpSlModalVisible && editingTpSlHolding && (
        <div className="modal-overlay" onClick={closeTpSlModal}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>设置止盈止损 - {editingTpSlHolding.name}</h3>
              <button className="modal-close" onClick={closeTpSlModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">成本价</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editingTpSlHolding.cost_price}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">当前价</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editingTpSlHolding.current_price ?? editingTpSlHolding.cost_price}
                    disabled
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">止盈价</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={tpSlForm.take_profit_price}
                    onChange={(e) =>
                      setTpSlForm({ ...tpSlForm, take_profit_price: e.target.value })
                    }
                    placeholder="高于当前价"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">止损价</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={tpSlForm.stop_loss_price}
                    onChange={(e) =>
                      setTpSlForm({ ...tpSlForm, stop_loss_price: e.target.value })
                    }
                    placeholder="低于当前价"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group form-group-full">
                  <button
                    className="btn btn-secondary"
                    onClick={autoCalculateTpSl}
                    disabled={tpSlLoading}
                  >
                    {tpSlLoading ? '计算中...' : '基于 ATR 自动计算'}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeTpSlModal}>
                取消
              </button>
              <button className="btn btn-primary" onClick={submitTpSlForm}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 仓位建议弹窗 */}
      {suggestionsModalVisible && (
        <div className="modal-overlay" onClick={closeSuggestionsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>仓位建议</h3>
              <button className="modal-close" onClick={closeSuggestionsModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="suggestion-summary">
                总资产：{formatCurrency(suggestionSummary.total_assets)}，
                风险承受：{suggestionSummary.risk_tolerance * 100}%
              </div>
              {suggestionsLoading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <span>计算中...</span>
                </div>
              ) : positionSuggestions.length === 0 ? (
                <div className="empty-cell">暂无可分析的持仓建议</div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>代码</th>
                        <th>名称</th>
                        <th className="text-center">评级</th>
                        <th className="text-right">当前仓位</th>
                        <th className="text-right">建议仓位</th>
                        <th className="text-right">建议金额</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionSuggestions.map((s) => (
                        <tr key={s.holding_id}>
                          <td className="code-cell">{s.code}</td>
                          <td className="name-cell">{s.name}</td>
                          <td className="text-center">
                            <span className={`signal-badge small ${s.rating}`}>
                              {s.rating.toUpperCase()}
                            </span>
                          </td>
                          <td className="text-right">
                            {formatPercent(s.current_position_ratio * 100)}
                          </td>
                          <td className="text-right">
                            {formatPercent(s.suggested_ratio * 100)}
                          </td>
                          <td className="text-right">{formatCurrency(s.suggested_value)}</td>
                          <td className="text-muted">{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeSuggestionsModal}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Portfolio
