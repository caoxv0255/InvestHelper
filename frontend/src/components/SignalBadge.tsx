import type { SignalRating, TechnicalSignal } from '../types'

interface SignalBadgeProps {
  /** 评级 */
  rating: SignalRating
  /** 评分 */
  score?: number
  /** 点击回调 */
  onClick?: () => void
  /** 是否可点击 */
  clickable?: boolean
  /** 尺寸 */
  size?: 'small' | 'medium'
}

/**
 * 技术信号评级标签
 * 中国 A 股习惯：红色代表上涨/买入，绿色代表下跌/卖出
 */
const SignalBadge = ({
  rating,
  score,
  onClick,
  clickable = false,
  size = 'small',
}: SignalBadgeProps) => {
  const config: Record<
    SignalRating,
    { text: string; className: string }
  > = {
    buy: { text: '买入', className: 'signal-badge buy' },
    sell: { text: '卖出', className: 'signal-badge sell' },
    hold: { text: '持有', className: 'signal-badge hold' },
    neutral: { text: '中性', className: 'signal-badge neutral' },
  }

  const { text, className } = config[rating] || config.neutral

  return (
    <span
      className={`${className} ${size} ${clickable ? 'clickable' : ''}`}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {text}
      {score !== undefined && <span className="signal-score">{score}</span>}
    </span>
  )
}

/**
 * 根据技术信号对象生成标签
 */
export const SignalBadgeFromResult = ({
  signal,
  onClick,
  clickable = false,
  size = 'small',
}: {
  signal?: TechnicalSignal
  onClick?: () => void
  clickable?: boolean
  size?: 'small' | 'medium'
}) => {
  if (!signal) {
    return <span className="signal-badge neutral small">-</span>
  }
  return (
    <SignalBadge
      rating={signal.rating}
      score={signal.score}
      onClick={onClick}
      clickable={clickable}
      size={size}
    />
  )
}

export default SignalBadge
