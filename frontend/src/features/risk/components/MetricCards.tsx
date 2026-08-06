/**
 * MetricCards — 关键指标三卡（VaR / 总市值 / 集中度 HHI）
 *
 * 接 3 个独立 props（避免整个 RiskAnalysisResult 耦合），纯展示组件。
 */
import { formatCurrency, formatPercent, formatLargeCurrency } from '../../../utils/format'
import type { RiskSummary, VaRResult } from '../../../types'

interface MetricCardsProps {
  varResult: VaRResult
  summary: RiskSummary
  hhi: number
  maxIndustryWeight: number
}

export const MetricCards = ({
  varResult,
  summary,
  hhi,
  maxIndustryWeight,
}: MetricCardsProps) => {
  return (
    <div className="metric-cards">
      <div className="metric-card">
        <div className="metric-label">单日最大可能损失 (VaR)</div>
        <div className={`metric-value ${varResult.percentage > 0.03 ? 'warning' : ''}`}>
          {formatCurrency(varResult.amount)}
        </div>
        <div className="metric-sub">
          在 {(varResult.confidence * 100).toFixed(0)}% 置信水平下，单日损失不超过{' '}
          {formatPercent(varResult.percentage * 100)}
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">组合总市值</div>
        <div className="metric-value">
          {formatLargeCurrency(summary.total_value)}
        </div>
        <div className="metric-sub">共 {summary.position_count} 只持仓</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">行业集中度 (HHI)</div>
        <div className="metric-value">{hhi.toFixed(4)}</div>
        <div className="metric-sub">
          最大行业权重: {formatPercent(maxIndustryWeight * 100)}
        </div>
      </div>
    </div>
  )
}