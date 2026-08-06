/**
 * OpportunityCard — 机会列表单卡（自管 expanded）
 *
 * 父组件只传 opportunity；卡片内部的展开/收起状态由自己管。
 * 展示：评分环 + 类型标签 + 现价 + 推荐理由摘要 + 展开详情（评分分解 + 补充信息 + 详情列表）。
 */
import { useState } from 'react'
import type { Opportunity } from '../../../types'
import { formatCurrency } from '../../../utils/format'
import { ScoreCircle } from './ScoreCircle'

interface OpportunityCardProps {
  opportunity: Opportunity
}

// 与原 Opportunities.tsx 顶部常量保持一致
const TYPE_LABELS: Record<string, string> = {
  momentum: '板块动量',
  technical: '技术信号',
  fund_flow: '资金流向',
}

export const OpportunityCard = ({ opportunity }: OpportunityCardProps) => {
  const [expanded, setExpanded] = useState(false)
  const { reason } = opportunity

  // 摘要：取详情前 2 条
  const summary = (reason?.details || []).slice(0, 2).join('；')

  return (
    <div
      className={`opportunity-card ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* 卡片头部：名称 + 评分 */}
      <div className="card-header">
        <div className="card-title-section">
          <h3 className="card-name">{opportunity.name || opportunity.code}</h3>
          <span className="card-code">{opportunity.code}</span>
        </div>
        <ScoreCircle score={opportunity.score} />
      </div>

      {/* 卡片中部：类型标签 + 价格 */}
      <div className="card-body">
        <span className={`type-tag ${opportunity.opportunity_type}`}>
          {TYPE_LABELS[opportunity.opportunity_type] || opportunity.opportunity_type}
        </span>
        <span className="card-price">
          <span className="card-price-label">现价</span>
          {formatCurrency(opportunity.price)}
        </span>
      </div>

      {/* 推荐理由摘要 */}
      {summary && <div className="card-reason-summary">{summary}</div>}

      {/* 展开详情 */}
      {expanded && (
        <div className="card-details">
          {/* 各维度得分分解 */}
          <div className="score-breakdown">
            <div className="breakdown-item">
              <div className="breakdown-label">技术面 (40%)</div>
              <div className={`breakdown-value ${reason?.tech_score == null ? 'na' : ''}`}>
                {reason?.tech_score != null ? reason.tech_score.toFixed(1) : '—'}
              </div>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-label">板块动量 (30%)</div>
              <div className={`breakdown-value ${reason?.sector_score == null ? 'na' : ''}`}>
                {reason?.sector_score != null ? reason.sector_score.toFixed(1) : '—'}
              </div>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-label">资金流 (30%)</div>
              <div className={`breakdown-value ${reason?.fund_score == null ? 'na' : ''}`}>
                {reason?.fund_score != null ? reason.fund_score.toFixed(1) : '—'}
              </div>
            </div>
          </div>

          {/* 补充信息 */}
          {(reason?.rating || reason?.sector || reason?.fund_flow != null) && (
            <div className="card-reason-summary" style={{ marginBottom: '0.5rem' }}>
              {reason?.rating && <span>评级: {reason.rating}；</span>}
              {reason?.sector && <span>板块: {reason.sector}；</span>}
              {reason?.fund_flow != null && (
                <span>主力净流入: {reason.fund_flow.toFixed(2)} 亿元</span>
              )}
            </div>
          )}

          {/* 详情列表 */}
          {reason?.details && reason.details.length > 0 && (
            <ul className="detail-list">
              {reason.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 展开提示 */}
      <div className="expand-hint">{expanded ? '▲ 收起' : '▼ 点击查看详情'}</div>
    </div>
  )
}