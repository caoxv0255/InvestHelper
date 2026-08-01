import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getOpportunities,
  scanOpportunities,
  getOpportunityHistory,
} from '../api/opportunities'
import type {
  Opportunity,
  OpportunityListResponse,
  OpportunityHistoryResponse,
} from '../types'
import { formatCurrency } from '../utils/format'
import '../styles/Opportunities.css'

// 机会类型中文标签
const TYPE_LABELS: Record<string, string> = {
  sector_momentum: '板块动量',
  tech_signal: '技术信号',
  fund_flow: '资金流向',
  composite: '综合机会',
}

// 筛选类型选项
const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'sector_momentum', label: '板块动量' },
  { value: 'tech_signal', label: '技术信号' },
  { value: 'fund_flow', label: '资金流向' },
  { value: 'composite', label: '综合机会' },
]

// 圆形进度条参数
const CIRCLE_RADIUS = 28
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

/**
 * 根据评分返回颜色等级
 * >=80 红色（高分）、60-80 橙色、<60 灰色
 */
const getScoreLevel = (score: number): string => {
  if (score >= 80) return 'score-high'
  if (score >= 60) return 'score-mid'
  return 'score-low'
}

/**
 * 圆形进度条组件
 */
const ScoreCircle = ({ score }: { score: number }) => {
  const level = getScoreLevel(score)
  // 进度偏移量：分数越高，偏移越小，进度环越长
  const offset = CIRCLE_CIRCUMFERENCE - (score / 100) * CIRCLE_CIRCUMFERENCE
  return (
    <div className="score-circle">
      <svg viewBox="0 0 64 64">
        <circle
          className="score-circle-bg"
          cx="32"
          cy="32"
          r={CIRCLE_RADIUS}
        />
        <circle
          className={`score-circle-progress ${level}`}
          cx="32"
          cy="32"
          r={CIRCLE_RADIUS}
          strokeDasharray={CIRCLE_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={`score-circle-value ${level}`}>{Math.round(score)}</span>
    </div>
  )
}

/**
 * 机会卡片组件
 */
const OpportunityCard = ({ opportunity }: { opportunity: Opportunity }) => {
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

const Opportunities = () => {
  // 活跃机会列表
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [scannedAt, setScannedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 筛选状态
  const [typeFilter, setTypeFilter] = useState('all')
  const [minScore, setMinScore] = useState(0)

  // 历史记录
  const [history, setHistory] = useState<Opportunity[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  // 获取活跃机会列表
  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result: OpportunityListResponse = await getOpportunities(50)
      setOpportunities(result.items || [])
      setScannedAt(result.scanned_at)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载投资机会失败'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  // 获取历史记录
  const fetchHistory = async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const result: OpportunityHistoryResponse = await getOpportunityHistory(30)
      setHistory(result.items || [])
    } catch (err: unknown) {
      // 历史记录加载失败不影响主流程，但仍告知用户
      setHistoryError(err instanceof Error ? err.message : '加载历史记录失败')
    } finally {
      setHistoryLoading(false)
    }
  }

  // 触发筛选扫描
  const handleScan = async () => {
    setScanning(true)
    setError(null)
    try {
      const result: OpportunityListResponse = await scanOpportunities()
      setOpportunities(result.items || [])
      setScannedAt(result.scanned_at)
      // 扫描完成后刷新历史记录
      if (historyExpanded) {
        fetchHistory()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '扫描机会失败'
      setError(msg)
    } finally {
      setScanning(false)
    }
  }

  // 切换历史记录展开
  const toggleHistory = () => {
    const newExpanded = !historyExpanded
    setHistoryExpanded(newExpanded)
    if (newExpanded && history.length === 0) {
      fetchHistory()
    }
  }

  // 初始加载
  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  // 筛选后的机会列表
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      // 类型筛选
      if (typeFilter !== 'all' && opp.opportunity_type !== typeFilter) {
        return false
      }
      // 最低评分筛选
      if (opp.score < minScore) {
        return false
      }
      return true
    })
  }, [opportunities, typeFilter, minScore])

  // 历史记录按日期分组
  const groupedHistory = useMemo(() => {
    const groups: Record<string, Opportunity[]> = {}
    history.forEach((opp) => {
      const dateKey = opp.discovered_date || '未知日期'
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(opp)
    })
    return groups
  }, [history])

  // 格式化扫描时间
  const formatScannedAt = (ts: string | null): string => {
    if (!ts) return '暂无'
    try {
      const d = new Date(ts)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return ts
    }
  }

  return (
    <div className="opportunities-page">
      {/* 页面头部 */}
      <div className="page-header">
        <h1 className="page-title">投资机会</h1>
        <div className="header-meta">
          <span className="text-muted">最近扫描: {formatScannedAt(scannedAt)}</span>
          <button
            className="btn-scan"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? '扫描中...' : '🔍 扫描机会'}
          </button>
        </div>
      </div>

      {/* 扫描中动画 */}
      {scanning && (
        <div className="scanning-overlay">
          <div className="scanning-spinner"></div>
          <div className="scanning-text">正在扫描投资机会...</div>
          <div className="scanning-subtext">分析板块动量、技术信号与资金流向</div>
        </div>
      )}

      {/* 错误消息 */}
      {error && !scanning && (
        <div className="error-message">
          {error}
          <button className="btn-link" onClick={fetchOpportunities}>
            重试
          </button>
        </div>
      )}

      {/* 工具栏 */}
      {!scanning && !error && (
        <div className="toolbar">
          <div className="toolbar-section">
            <span className="toolbar-label">机会类型</span>
            <div className="type-filter-group">
              {TYPE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`type-filter-btn ${typeFilter === opt.value ? 'active' : ''}`}
                  onClick={() => setTypeFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar-section">
            <span className="toolbar-label">最低评分</span>
            <input
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="score-slider"
            />
            <span className="score-slider-value">{minScore}</span>
          </div>
        </div>
      )}

      {/* 机会列表 */}
      {!scanning && !error && (
        <>
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <span>加载中...</span>
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">
                {opportunities.length === 0 ? '暂无投资机会' : '没有符合筛选条件的机会'}
              </div>
              <div className="empty-state-sub">
                {opportunities.length === 0
                  ? '点击"扫描机会"按钮开始筛选'
                  : '尝试调整筛选条件或重新扫描'}
              </div>
            </div>
          ) : (
            <div className="opportunities-grid">
              {filteredOpportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          )}

          {/* 历史记录区域（可折叠） */}
          <div className="history-section">
            <div className="history-header" onClick={toggleHistory}>
              <span className="history-title">
                📅 历史记录（近30天）
              </span>
              <span className="history-toggle">
                {historyExpanded ? '收起' : '展开'}
                <span className={`history-toggle-icon ${historyExpanded ? '' : 'collapsed'}`}>
                  ▼
                </span>
              </span>
            </div>

            {historyExpanded && (
              <div className="history-content">
                {historyError && (
                  <div className="history-error-banner">⚠️ {historyError}</div>
                )}
                {historyLoading ? (
                  <div className="history-loading">加载历史记录中...</div>
                ) : Object.keys(groupedHistory).length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-text">暂无历史记录</div>
                  </div>
                ) : (
                  Object.entries(groupedHistory).map(([date, items]) => (
                    <div className="history-group" key={date}>
                      <div className="history-date">{date}（{items.length} 条）</div>
                      <div className="history-items">
                        {items.map((opp) => {
                          const level = getScoreLevel(opp.score)
                          return (
                            <div className="history-item" key={opp.id}>
                              <div className="history-item-info">
                                <div className="history-item-name">
                                  {opp.name || opp.code}
                                </div>
                                <div className="history-item-meta">
                                  {opp.code} · {TYPE_LABELS[opp.opportunity_type] || opp.opportunity_type}
                                  <span className={`history-item-status ${opp.status}`}>
                                    {opp.status === 'active' ? '活跃' : '已过期'}
                                  </span>
                                </div>
                              </div>
                              <span className={`history-item-score ${level}`}>
                                {Math.round(opp.score)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Opportunities
