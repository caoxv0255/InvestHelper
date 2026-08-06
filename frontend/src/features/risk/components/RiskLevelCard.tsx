/**
 * RiskLevelCard — 顶部风险等级大卡片
 *
 * 接 RiskScore 对象，渲染：
 *   风险等级标签 + 中文描述 + 4 个风险因子得分（综合/集中度/相关性/VaR）
 *
 * 不持有 state，纯展示。
 */
import type { RiskLevel, RiskScore } from '../../../types'

// 原 Opportunities 的 TYPE_LABELS 用 fallback 模式，RiskLevel 也对齐：Partial<Record> 允许部分定义，
// 运行时访问 undefined 与原代码行为一致（JSX 渲染为空）
const RISK_LEVEL_DESC: Partial<Record<RiskLevel, string>> = {
  low: '您的投资组合分散度较好，单一行业或标的风险可控。',
  medium: '组合整体风险适中，建议关注集中度较高的行业和标的。',
  high: '组合风险较高，存在行业集中或标的相关性过大的问题。',
}

interface RiskLevelCardProps {
  riskScore: RiskScore
}

export const RiskLevelCard = ({ riskScore }: RiskLevelCardProps) => {
  return (
    <div className={`risk-level-card ${riskScore.level}`}>
      <div className="risk-level-label">当前风险等级</div>
      <div className="risk-level-value">{riskScore.label}</div>
      <div className="risk-level-desc">{RISK_LEVEL_DESC[riskScore.level]}</div>

      <div className="risk-factors">
        <div className="risk-factor">
          <span className="risk-factor-name">综合得分</span>
          <span className="risk-factor-value">{riskScore.factors.total_score}</span>
        </div>
        <div className="risk-factor">
          <span className="risk-factor-name">集中度得分</span>
          <span className="risk-factor-value">{riskScore.factors.concentration_score}</span>
        </div>
        <div className="risk-factor">
          <span className="risk-factor-name">相关性得分</span>
          <span className="risk-factor-value">{riskScore.factors.correlation_score}</span>
        </div>
        <div className="risk-factor">
          <span className="risk-factor-name">VaR 得分</span>
          <span className="risk-factor-value">{riskScore.factors.var_score}</span>
        </div>
      </div>
    </div>
  )
}