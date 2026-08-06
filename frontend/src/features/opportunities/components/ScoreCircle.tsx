/**
 * ScoreCircle — 圆形评分环（纯展示组件）
 *
 * 接收 0-100 的 score，渲染 SVG 进度环 + 中心数字。
 * 同时 export `getScoreLevel` 给 OpportunityCard / HistorySection 复用。
 */
const CIRCLE_RADIUS = 28
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

export type ScoreLevel = 'score-high' | 'score-mid' | 'score-low'

/**
 * 根据评分返回颜色等级：
 * >=80 高分（红）、60-80 中分（橙）、<60 低分（灰）
 */
export const getScoreLevel = (score: number): ScoreLevel => {
  if (score >= 80) return 'score-high'
  if (score >= 60) return 'score-mid'
  return 'score-low'
}

interface ScoreCircleProps {
  score: number
}

export const ScoreCircle = ({ score }: ScoreCircleProps) => {
  const level = getScoreLevel(score)
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