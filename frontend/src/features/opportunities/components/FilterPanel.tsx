/**
 * FilterPanel — 筛选工具栏
 *
 * 父组件传入：
 *   typeFilter / minScore / onTypeFilterChange / onMinScoreChange
 * FilterPanel 不持有任何状态——纯 controlled 组件，便于 useOpportunities 统一管理筛选。
 */
import { TYPE_FILTER_OPTIONS } from '../hooks/useOpportunities'

interface FilterPanelProps {
  typeFilter: string
  minScore: number
  onTypeFilterChange: (value: string) => void
  onMinScoreChange: (value: number) => void
}

export const FilterPanel = ({
  typeFilter,
  minScore,
  onTypeFilterChange,
  onMinScoreChange,
}: FilterPanelProps) => {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <span className="toolbar-label">机会类型</span>
        <div className="type-filter-group">
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`type-filter-btn ${typeFilter === opt.value ? 'active' : ''}`}
              onClick={() => onTypeFilterChange(opt.value)}
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
          onChange={(e) => onMinScoreChange(Number(e.target.value))}
          className="score-slider"
        />
        <span className="score-slider-value">{minScore}</span>
      </div>
    </div>
  )
}