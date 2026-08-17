/**
 * DepositTable — Phase C (Portfolio migration)
 *
 * 定期理财表格 + 筛选. Migrated to <Button> + <Select> + <Badge> primitives.
 */
import type { Deposit } from '../../../types'
import { formatCurrency, formatDate } from '../../../utils/format'
import { TableSkeleton } from '../../../components/TableSkeleton'
import { Button } from '../../../components/ui/Button'
import { Select } from '../../../components/ui/Select'
import { Badge, type BadgeVariant } from '../../../components/ui/Badge'

export interface DepositTableProps {
  deposits: Deposit[]
  depositsLoading: boolean
  depositsError: string | null
  statusFilter: string
  onStatusFilterChange: (v: string) => void
  onRefresh: () => void
  onAddDeposit: () => void
  onEditDeposit: (deposit: Deposit) => void
  onDeleteDeposit: (id: number, name: string) => void
}

/**
 * toNum — fence post against backend returning decimal strings.
 */
const toNum = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const n = parseFloat(String(value))
  return Number.isFinite(n) ? n : 0
}

function getRemainingDays(maturityDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maturity = new Date(maturityDate)
  maturity.setHours(0, 0, 0, 0)
  const diff = maturity.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// deposit.status → Badge variant
// Default fallback 'neutral' to avoid runtime error if backend adds new status
function depositStatusToVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active':
      return 'success'
    case 'matured':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function depositStatusToText(status: string): string {
  switch (status) {
    case 'active':
      return '持有中'
    case 'matured':
      return '已到期'
    default:
      return status
  }
}

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'active', label: '持有中' },
  { value: 'matured', label: '已到期' },
]

export const DepositTable = ({
  deposits,
  depositsLoading,
  depositsError,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  onAddDeposit,
  onEditDeposit,
  onDeleteDeposit,
}: DepositTableProps) => {
  return (
    <div className="tab-content">
      {/* 筛选和操作栏 */}
      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">状态：</label>
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          />
        </div>
        <div className="filter-spacer"></div>
        <Button variant="primary" onClick={onAddDeposit}>
          + 添加定期
        </Button>
      </div>

      {/* 加载状态 */}
      {depositsLoading && <TableSkeleton rows={3} columns={9} />}

      {/* 错误提示 */}
      {depositsError && (
        <div className="error-message">
          <span>{depositsError}</span>
          <Button variant="ghost" onClick={onRefresh}>
            重试
          </Button>
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
                  let rowClassName = ''
                  if (deposit.status === 'matured' || remainingDays < 0) {
                    rowClassName = 'row-matured'
                  } else if (remainingDays <= 7) {
                    rowClassName = 'row-warning'
                  }

                  return (
                    <tr key={deposit.id} className={rowClassName}>
                      <td className="name-cell">{deposit.product_name}</td>
                      <td className="text-right">{formatCurrency(toNum(deposit.principal))}</td>
                      <td className="text-right">{toNum(deposit.annual_rate).toFixed(2)}%</td>
                      <td>{formatDate(deposit.start_date)}</td>
                      <td>{formatDate(deposit.maturity_date)}</td>
                      <td
                        className="text-right"
                        style={{ color: 'var(--color-profit-up)' }}
                      >
                        +{formatCurrency(toNum(deposit.expected_return))}
                      </td>
                      <td>
                        <Badge variant={depositStatusToVariant(deposit.status)}>
                          {depositStatusToText(deposit.status)}
                        </Badge>
                      </td>
                      <td className="text-right">
                        {remainingDays < 0 ? '已到期' : `${remainingDays}天`}
                      </td>
                      <td className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditDeposit(deposit)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteDeposit(deposit.id, deposit.product_name)}
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
