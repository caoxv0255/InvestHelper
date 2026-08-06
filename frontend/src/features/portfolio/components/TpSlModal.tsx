/**
 * 止盈止损设置弹窗
 *
 * parent 负责：管理 holding/form/loading 状态、API 调用、提交后刷新。
 * modal 只负责渲染 + 表单字段更新回调。
 */
import type { Holding } from '../../../types'

export interface TpSlFormState {
  take_profit_price: string
  stop_loss_price: string
}

export interface TpSlModalProps {
  visible: boolean
  holding: Holding | null
  form: TpSlFormState
  loading: boolean
  onChange: (next: TpSlFormState) => void
  onAutoCalculate: () => void
  onSubmit: () => void
  onClose: () => void
}

export const TpSlModal = ({
  visible,
  holding,
  form,
  loading,
  onChange,
  onAutoCalculate,
  onSubmit,
  onClose,
}: TpSlModalProps) => {
  if (!visible || !holding) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>设置止盈止损 - {holding.name}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">成本价</label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={String(holding.cost_price)}
                disabled
              />
            </div>
            <div className="form-group">
              <label className="form-label">当前价</label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={String(holding.current_price ?? holding.cost_price)}
                disabled
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">止盈价</label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={form.take_profit_price}
                onChange={(e) =>
                  onChange({ ...form, take_profit_price: e.target.value })
                }
                placeholder="高于当前价"
              />
            </div>
            <div className="form-group">
              <label className="form-label">止损价</label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={form.stop_loss_price}
                onChange={(e) =>
                  onChange({ ...form, stop_loss_price: e.target.value })
                }
                placeholder="低于当前价"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group form-group-full">
              <button
                className="btn btn-secondary"
                onClick={onAutoCalculate}
                disabled={loading}
              >
                {loading ? '计算中...' : '基于 ATR 自动计算'}
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>取消</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}