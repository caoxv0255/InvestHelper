/**
 * 仓位建议弹窗
 *
 * 显示组合总资产/风险承受 + 每只持仓的当前仓位 vs 建议仓位。
 */
import type { PositionSuggestion } from '../../../types'
import { formatCurrency, formatPercent } from '../../../utils/format'

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
  if (!visible) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>仓位建议</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="suggestion-summary">
            总资产：{formatCurrency(summary.total_assets)}，
            风险承受：{summary.risk_tolerance * 100}%
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
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}