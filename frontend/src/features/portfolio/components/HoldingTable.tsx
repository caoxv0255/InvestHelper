/**
 * 持仓表格 + 筛选 + 止盈止损预警横幅
 *
 * Props drill 设计：父组件 (Portfolio.tsx) 负责状态管理 + 数据 fetch，
 * 本组件只负责渲染和回调转发。
 */
import type {
  Holding,
  TechnicalSignal,
  PositionSuggestion,
  PositionAlertItem,
} from '../../../types'
import { SignalBadgeFromResult } from '../../../components/SignalBadge'
import { TableSkeleton } from '../../../components/TableSkeleton'
import { formatCurrency, formatPercent } from '../../../utils/format'

export interface HoldingTableProps {
  // 数据
  holdings: Holding[]
  holdingsLoading: boolean
  holdingsError: string | null
  signalMap: Record<string, TechnicalSignal>
  signalsLoading: boolean
  positionSuggestions: PositionSuggestion[]
  suggestionsLoading: boolean
  positionAlerts: PositionAlertItem[]

  // 筛选
  platformFilter: string
  assetTypeFilter: string
  onPlatformFilterChange: (v: string) => void
  onAssetTypeFilterChange: (v: string) => void

  // 操作回调
  onRefresh: () => void
  onOpenSuggestions: () => void
  onAddHolding: () => void
  onEditHolding: (holding: Holding) => void
  onDeleteHolding: (id: number, name: string) => void
  onOpenTpSl: (holding: Holding) => void
  onOpenSignal: (holding: Holding) => void
}

// ----- 内部纯函数（不依赖 React state）-----

/**
 * toNum — 把后端 Numeric/Decimal 字段安全转成 number
 *
 * 后端 SQLAlchemy + Pydantic 把 Numeric 列序列化成 JSON string（如 "1500.000000"），
 * 而前端 TypeScript 类型仍声明 number。运行时如果直接 toFixed() / 算术运算就会崩。
 * 这里在消费侧做一次 coerce，是 fence post 修复，不动后端契约。
 */
const toNum = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'string') return parseFloat(v)
  return v
}

function calculateProfit(holding: Holding): number {
  if (!holding.current_price) return 0
  return (toNum(holding.current_price) - toNum(holding.cost_price)) * toNum(holding.quantity)
}

function calculateProfitPercent(holding: Holding): number {
  if (!holding.current_price || holding.cost_price === 0) return 0
  return ((toNum(holding.current_price) - toNum(holding.cost_price)) / toNum(holding.cost_price)) * 100
}

function calculateMarketValue(holding: Holding): number {
  if (!holding.current_price) return toNum(holding.cost_price) * toNum(holding.quantity)
  return toNum(holding.current_price) * toNum(holding.quantity)
}

function getPlatformLabel(platform: string): { text: string; className: string } {
  const labels: Record<string, { text: string; className: string }> = {
    alipay: { text: '支付宝', className: 'platform-tag alipay' },
    cmb: { text: '招行', className: 'platform-tag cmb' },
    ths: { text: '同花顺', className: 'platform-tag ths' },
  }
  return labels[platform] || { text: platform, className: 'platform-tag' }
}

function getAssetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    fund: '基金',
    stock: '股票',
    deposit: '定期理财',
  }
  return labels[type] || type
}

export const HoldingTable = ({
  holdings,
  holdingsLoading,
  holdingsError,
  signalMap,
  signalsLoading,
  positionSuggestions,
  suggestionsLoading,
  positionAlerts,
  platformFilter,
  assetTypeFilter,
  onPlatformFilterChange,
  onAssetTypeFilterChange,
  onRefresh,
  onOpenSuggestions,
  onAddHolding,
  onEditHolding,
  onDeleteHolding,
  onOpenTpSl,
  onOpenSignal,
}: HoldingTableProps) => {
  return (
    <div className="tab-content">
      {/* 筛选和操作栏 */}
      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">平台：</label>
          <select
            className="filter-select"
            value={platformFilter}
            onChange={(e) => onPlatformFilterChange(e.target.value)}
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
            onChange={(e) => onAssetTypeFilterChange(e.target.value)}
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
          onClick={onOpenSuggestions}
          disabled={suggestionsLoading}
        >
          {suggestionsLoading ? '计算中...' : '仓位建议'}
        </button>
        <button className="btn btn-primary" onClick={onAddHolding}>
          + 添加持仓
        </button>
      </div>

      {/* 止盈止损预警 */}
      {!holdingsLoading && positionAlerts.length > 0 && (
        <div className="alert-banner">
          <div className="alert-banner-title">⚠ 止盈止损预警</div>
          <ul className="alert-banner-list">
            {positionAlerts.map((alert) => (
              <li key={alert.holding_id}>{alert.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 加载状态 — skeleton placeholder (10 columns x 5 rows) */}
      {holdingsLoading && (
        <TableSkeleton rows={5} columns={10} />
      )}

      {/* 错误提示 */}
      {holdingsError && (
        <div className="error-message">
          {holdingsError}
          <button className="btn-link" onClick={onRefresh}>重试</button>
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
                  const alert = positionAlerts.find(
                    (a) => a.holding_id === holding.id,
                  )
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
                      <td className="text-right">{toNum(holding.quantity).toFixed(2)}</td>
                      <td className="text-right">{toNum(holding.cost_price).toFixed(4)}</td>
                      <td className="text-right">
                        {holding.current_price ? toNum(holding.current_price).toFixed(4) : '-'}
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
                            onClick={() => onOpenSignal(holding)}
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
                          onClick={() => onOpenTpSl(holding)}
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
                          onClick={() => onEditHolding(holding)}
                        >
                          编辑
                        </button>
                        <button
                          className="btn-link btn-delete"
                          onClick={() => onDeleteHolding(holding.id, holding.name)}
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
  )
}