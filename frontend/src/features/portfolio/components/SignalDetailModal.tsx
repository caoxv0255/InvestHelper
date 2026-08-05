/**
 * 技术信号详情弹窗
 *
 * 显示综合评分、研判结论、分项信号、异常信息。
 * parent 通过 signal=null 控制关闭。
 */
import type { TechnicalSignal } from '../../../types'
import { SignalBadgeFromResult } from '../../../components/SignalBadge'

export interface SignalDetailModalProps {
  signal: TechnicalSignal | null
  onClose: () => void
}

export const SignalDetailModal = ({ signal, onClose }: SignalDetailModalProps) => {
  if (!signal) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {signal.name || signal.code} 技术信号
            <span style={{ marginLeft: '0.75rem' }}>
              <SignalBadgeFromResult signal={signal} size="medium" />
            </span>
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="signal-detail-section">
            <div className="signal-detail-title">综合评分</div>
            <div className="signal-detail-score">
              <span>{signal.score}</span>
              <div className="signal-score-bar">
                <div
                  className="signal-score-fill"
                  style={{ width: `${signal.score}%` }}
                />
              </div>
            </div>
            <div className="signal-detail-title">研判结论</div>
            <ul className="signal-detail-list">
              {signal.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </div>

          <div className="signal-detail-section">
            <div className="signal-detail-title">分项信号</div>
            {signal.signals.map((item) => (
              <div key={item.category} style={{ marginBottom: '0.75rem' }}>
                <strong>{item.category}</strong>
                {!item.valid ? (
                  <div className="signal-detail-empty">{item.reason}</div>
                ) : item.signals.length === 0 ? (
                  <div className="signal-detail-empty">暂无明确信号</div>
                ) : (
                  <ul className="signal-detail-list">
                    {item.signals.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {signal.error && (
            <div className="signal-detail-section">
              <div className="signal-detail-title">异常信息</div>
              <div className="signal-detail-empty">{signal.error}</div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}