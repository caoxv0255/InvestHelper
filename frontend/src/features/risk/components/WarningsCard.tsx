/**
 * WarningsCard — 计算提示警告列表卡片
 *
 * 接 warnings 字符串数组，渲染列表。
 * 与 LargestWarning 共享 .warning-card 样式但内容/触发逻辑不同。
 */
interface WarningsCardProps {
  warnings: string[]
}

export const WarningsCard = ({ warnings }: WarningsCardProps) => {
  if (warnings.length === 0) return null
  return (
    <div className="warning-card">
      <div className="warning-icon">⚠️</div>
      <div className="warning-content">
        <div className="warning-title">计算提示</div>
        <div className="warning-desc">
          <ul className="warning-list">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}