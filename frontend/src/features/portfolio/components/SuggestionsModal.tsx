/**
 * SuggestionsModal — Phase C (Portfolio migration)
 *
 * 仓位建议弹窗. Migrated to <Modal> + <Badge> primitives.
 */
import type { PositionSuggestion } from '../../../types'
import { formatCurrency, formatPercent } from '../../../utils/format'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { ratingToVariant } from '../lib/ratingVariant'

export interface SuggestionsModalProps {
  visible: boolean
  summary: { total_assets: number; risk_tolerance: number }
  suggestions: PositionSuggestion[]
  loading: boolean
  onClose: () => void
}

export const SuggestionsModal = ({
  visible,
  summary,
  suggestions,
  loading,
  onClose,
}: SuggestionsModalProps) => {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="仓位建议"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="suggestion-summary">
        总资产：{formatCurrency(summary.total_assets)}，风险承受：
        {summary.risk_tolerance * 100}%
      </div>
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>计算中...</span>
        </div>
      ) : suggestions.length === 0 ? (
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
              {suggestions.map((s) => (
                <tr key={s.holding_id}>
                  <td className="code-cell">{s.code}</td>
                  <td className="name-cell">{s.name}</td>
                  <td className="text-center">
                    <Badge variant={ratingToVariant(s.rating)}>
                      {s.rating.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="text-right">
                    {formatPercent(s.current_position_ratio * 100)}
                  </td>
                  <td className="text-right">
                    {formatPercent(s.suggested_ratio * 100)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(s.suggested_value)}
                  </td>
                  <td className="text-muted">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
