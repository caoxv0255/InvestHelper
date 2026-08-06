/**
 * OpportunitiesPage — 投资机会页面（thin 路由组件）
 *
 * 组合：
 *   useOpportunities({ typeFilter, minScore })  → 列表 + scan + 筛选态
 *   <FilterPanel />                              → controlled 筛选 UI
 *   <OpportunityCard /> ×N                       → 自管 expanded 卡片
 *   <HistorySection />                           → 自管折叠历史
 *
 * 保留：
 *   - 页面级 typeFilter / minScore state（controlled 模式，FilterPanel 不持有）
 *   - scannedAt 时间戳格式化（页面级 utility，与 hooks 解耦）
 *   - loading / scanning / error 分层渲染
 */
import { useState } from 'react'
import { useOpportunities } from './hooks/useOpportunities'
import { OpportunityCard } from './components/OpportunityCard'
import { TableSkeleton } from '../../components/TableSkeleton'
import { FilterPanel } from './components/FilterPanel'
import { HistorySection } from './components/HistorySection'

const formatScannedAt = (ts: string | null): string => {
  if (!ts) return '暂无'
  try {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ts
  }
}

export const OpportunitiesPage = () => {
  // 筛选态：页面级持有,因 FilterPanel 是 controlled 组件
  const [typeFilter, setTypeFilter] = useState('all')
  const [minScore, setMinScore] = useState(0)

  const {
    opportunities,
    filteredOpportunities,
    loading,
    scanning,
    error,
    scannedAt,
    scan,
    refresh,
  } = useOpportunities({ typeFilter, minScore })

  return (
    <div className="opportunities-page">
      {/* 页面头部 */}
      <div className="page-header">
        <h1 className="page-title">投资机会</h1>
        <div className="header-meta">
          <span className="text-muted">最近扫描: {formatScannedAt(scannedAt)}</span>
          <button
            className="btn-scan"
            onClick={scan}
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
          <button className="btn-link" onClick={refresh}>
            重试
          </button>
        </div>
      )}

      {/* 主体：toolbar + 列表 + 历史 */}
      {!scanning && !error && (
        <>
          <FilterPanel
            typeFilter={typeFilter}
            minScore={minScore}
            onTypeFilterChange={setTypeFilter}
            onMinScoreChange={setMinScore}
          />

          {loading ? (
            <div className="opportunities-skeleton">
              <TableSkeleton rows={4} columns={3} />
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

          <HistorySection />
        </>
      )}
    </div>
  )
}

export default OpportunitiesPage