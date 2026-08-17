/**
 * HoldingTable — Phase C (Portfolio migration)
 *
 * 持仓表格 + 筛选 + 止盈止损预警横幅. Migrated to <Button> + <Select>
 * + <Badge> primitives. Signal rating → Badge variant via shared helper.
 */
import type {
  Holding,
  TechnicalSignal,
  PositionSuggestion,
  PositionAlertItem,
} from '../../../types'
import { TableSkeleton } from '../../../components/TableSkeleton'
import { formatCurrency, formatPercent } from '../../../utils/format'
import { Button } from '../../../components/ui/Button'
import { Select } from '../../../components/ui/Select'
import { Badge } from '../../../components/ui/Badge'
import { ratingToVariant, ratingToText } from '../lib/ratingVariant'

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

// ----- 内部纯函数 -----

/**
 * toNum — fence post against backend returning decimal strings for Numeric.
 */
const toNum = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? n : 0
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

function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    alipay: '支付宝',
    cmb: '招行',
    ths: '同花顺',
  }
  return labels[platform] || platform
}

function getAssetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    fund: '基金',
    stock: '股票',
    deposit: '定期理财',
  }
  return labels[type] || type
}

const PLATFORM_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'alipay', label: '支付宝' },
  { value: 'cmb', label: '招行' },
  { value: 'ths', label: '同花顺' },
]

const ASSET_TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'fund', label: '基金' },
  { value: 'stock', label: '股票' },
  { value: 'deposit', label: '定期理财' },
]

// Local component: clickable signal badge (wraps Badge primitive)
function ClickableSignalBadge({
  signal,
  onClick,
}: {
  signal: TechnicalSignal | undefined
  onClick: () => void
}) {
  if (!signal) return <span className="text-muted">-</span>
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{ cursor: 'pointer', display: 'inline-block' }}
    >
      <Badge variant={ratingToVariant(signal.rating)}>
        {ratingToText(signal.rating)} {signal.score}
      </Badge>
    </span>
  )
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
          <Select
            options={PLATFORM_OPTIONS}
            value={platformFilter}
            onChange={(e) => onPlatformFilterChange(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">资产类型：</label>
          <Select
            options={ASSET_TYPE_OPTIONS}
            value={assetTypeFilter}
            onChange={(e) => onAssetTypeFilterChange(e.target.value)}
          />
        </div>
        <div className="filter-spacer"></div>
        <Button
          variant="secondary"
          onClick={onOpenSuggestions}
          disabled={suggestionsLoading}
        >
          {suggestionsLoading ? '计算中...' : '仓位建议'}
        </Button>
        <Button variant="primary" onClick={onAddHolding}>
          + 添加持仓
        </Button>
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

      {/* 加载状态 — skeleton placeholder */}
      {holdingsLoading && <TableSkeleton rows={5} columns={10} />}

      {/* 错误提示 */}
      {holdingsError && (
        <div className="error-message">
          <span>{holdingsError}</span>
          <Button variant="ghost" onClick={onRefresh}>
            重试
          </Button>
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
                  const isPositive = profit >= 0
                  const suggestion = positionSuggestions.find(
                    (s) => s.holding_id === holding.id,
                  )
                  const alert = positionAlerts.find(
                    (a) => a.holding_id === holding.id,
                  )
                  const rowClassName = alert ? 'row-alert' : ''
                  const profitColor = isPositive
                    ? 'var(--color-profit-up)'
                    : 'var(--color-profit-down)'

                  return (
                    <tr key={holding.id} className={rowClassName}>
                      <td>{getPlatformLabel(holding.platform)}</td>
                      <td>{getAssetTypeLabel(holding.asset_type)}</td>
                      <td className="code-cell">{holding.code}</td>
                      <td className="name-cell">{holding.name}</td>
                      <td className="text-right">{toNum(holding.quantity).toFixed(2)}</td>
                      <td className="text-right">{toNum(holding.cost_price).toFixed(4)}</td>
                      <td className="text-right">
                        {holding.current_price ? toNum(holding.current_price).toFixed(4) : '-'}
                      </td>
                      <td className="text-right">{formatCurrency(marketValue)}</td>
                      <td className="text-right" style={{ color: profitColor }}>
                        {isPositive ? '+' : ''}
                        {formatCurrency(profit)}
                      </td>
                      <td className="text-right" style={{ color: profitColor }}>
                        {formatPercent(profitPercent)}
                      </td>
                      <td className="text-center">
                        {signalsLoading && !signalMap[holding.code] ? (
                          <Badge variant="neutral">加载中</Badge>
                        ) : (
                          <ClickableSignalBadge
                            signal={signalMap[holding.code]}
                            onClick={() => onOpenSignal(holding)}
                          />
                        )}
                      </td>
                      <td className="text-center">
                        {suggestionsLoading || !suggestion ? (
                          <span className="text-muted">-</span>
                        ) : (
                          <Badge variant="info" title={suggestion.reason}>
                            {formatPercent(suggestion.suggested_ratio * 100)}
                          </Badge>
                        )}
                      </td>
                      <td className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenTpSl(holding)}
                          title={alert ? alert.message : '设置止盈止损'}
                        >
                          {alert ? (
                            <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                              已触发
                            </span>
                          ) : holding.take_profit_price || holding.stop_loss_price ? (
                            '已设置'
                          ) : (
                            '未设置'
                          )}
                        </Button>
                      </td>
                      <td className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditHolding(holding)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteHolding(holding.id, holding.name)}
                        >
                          删除
                        </Button>
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
