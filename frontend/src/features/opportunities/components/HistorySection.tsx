/**
 * HistorySection — 历史记录折叠面板（自管数据加载与展开状态）
 *
 * 内部 useOpportunityHistory()，无需父组件传入任何 state。
 * 父组件只需在合适位置渲染 <HistorySection />。
 *
 * 渲染：折叠头 + 错误横幅 + 加载文案 + 按日期分组的历史列表。
 */
import { useOpportunityHistory } from '../hooks/useOpportunityHistory'
import { getScoreLevel } from './ScoreCircle'

const TYPE_LABELS: Record<string, string> = {
  momentum: '板块动量',
  technical: '技术信号',
  fund_flow: '资金流向',
}

export const HistorySection = () => {
  const { groupedHistory, loading, error, expanded, toggle } =
    useOpportunityHistory(30)

  return (
    <div className="history-section">
      <div className="history-header" onClick={toggle}>
        <span className="history-title">📅 历史记录（近30天）</span>
        <span className="history-toggle">
          {expanded ? '收起' : '展开'}
          <span className={`history-toggle-icon ${expanded ? '' : 'collapsed'}`}>
            ▼
          </span>
        </span>
      </div>

      {expanded && (
        <div className="history-content">
          {error && <div className="history-error-banner">⚠️ {error}</div>}
          {loading ? (
            <div className="history-loading">加载历史记录中...</div>
          ) : Object.keys(groupedHistory).length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">暂无历史记录</div>
            </div>
          ) : (
            Object.entries(groupedHistory).map(([date, items]) => (
              <div className="history-group" key={date}>
                <div className="history-date">
                  {date}（{items.length} 条）
                </div>
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
                            {opp.code} ·{' '}
                            {TYPE_LABELS[opp.opportunity_type] ||
                              opp.opportunity_type}
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
  )
}