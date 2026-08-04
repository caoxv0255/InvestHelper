/**
 * 定期理财表格 + 筛选
 */
import type { Deposit } from '../../../types'
import { formatCurrency, formatDate } from '../../../utils/format'

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

function getRemainingDays(maturityDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maturity = new Date(maturityDate)
  maturity.setHours(0, 0, 0, 0)
  const diff = maturity.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getStatusLabel(status: string): { text: string; className: string } {
  const labels: Record<string, { text: string; className: string }> = {
    active: { text: '持有中', className: 'status-tag active' },
    matured: { text: '已到期', className: 'status-tag matured' },
  }
  return labels[status] || { text: status, className: 'status-tag' }
}

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
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">全部</option>
            <option value="active">持有中</option>
            <option value="matured">已到期</option>
          </select>
        </div>
        <div className="filter-spacer"></div>
        <button className="btn btn-primary" onClick={onAddDeposit}>
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
          <button className="btn-link" onClick={onRefresh}>重试</button>
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
                          onClick={() => onEditDeposit(deposit)}
                        >
                          编辑
                        </button>
                        <button
                          className="btn-link btn-delete"
                          onClick={() => onDeleteDeposit(deposit.id, deposit.product_name)}
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