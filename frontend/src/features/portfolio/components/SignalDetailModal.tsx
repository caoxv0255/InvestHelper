/**
 * SignalDetailModal — Phase C (Portfolio migration)
 *
 * 技术信号详情弹窗. Migrated to <Modal> + <Badge> primitives.
 *
 * Note: signal → Badge variant mapping lives in features/portfolio/lib/
 * (not in Badge primitive) per separation of concerns — primitives
 * must not know finance domain. A-share convention: buy=up=RED,
 * sell=down=GREEN.
 */
import type { TechnicalSignal } from '../../../types'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { ratingToVariant, ratingToText } from '../lib/ratingVariant'

export interface SignalDetailModalProps {
  signal: TechnicalSignal | null
  onClose: () => void
}

export const SignalDetailModal = ({ signal, onClose }: SignalDetailModalProps) => {
  return (
    <Modal
      visible={!!signal}
      onClose={onClose}
      title={signal ? `${signal.name || signal.code} 技术信号` : '技术信号'}
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      {signal && (
        <>
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
              <Badge variant={ratingToVariant(signal.rating)}>
                {ratingToText(signal.rating)}
              </Badge>
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
              <div
                key={item.category}
                style={{ marginBottom: 'var(--space-3)' }}
              >
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
        </>
      )}
    </Modal>
  )
}
