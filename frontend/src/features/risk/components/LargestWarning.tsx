/**
 * LargestWarning — 最大单一持仓占比警告卡片
 *
 * 接 code / weight，渲染警告文案与图标。
 * 触发条件由父组件判断（weight > 0.3）。
 */
import { formatPercent } from '../../../utils/format'

interface LargestWarningProps {
  code: string
  weight: number
}

export const LargestWarning = ({ code, weight }: LargestWarningProps) => {
  return (
    <div className="warning-card">
      <div className="warning-icon">⚠️</div>
      <div className="warning-content">
        <div className="warning-title">最大单一持仓占比过高</div>
        <div className="warning-desc">
          {code} 占比达到 {formatPercent(weight * 100)}，
          建议适当分散以降低单一标的风险。
        </div>
      </div>
    </div>
  )
}