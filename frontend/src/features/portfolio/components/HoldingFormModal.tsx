/**
 * 持仓新增/编辑表单弹窗
 *
 * 父组件负责管理 visible / form / errors / loading 状态，
 * 本组件只负责渲染 + 校验触发 + 表单字段更新回调。
 */
import type { Holding, HoldingCreate } from '../../../types'

export interface HoldingFormModalProps {
  visible: boolean
  editing: Holding | null
  form: HoldingCreate
  errors: Record<string, string>
  onChange: (next: HoldingCreate) => void
  onCancel: () => void
  onSubmit: () => void
}

export const HoldingFormModal = ({
  visible,
  editing,
  form,
  errors,
  onChange,
  onCancel,
  onSubmit,
}: HoldingFormModalProps) => {
  if (!visible) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editing ? '编辑持仓' : '添加持仓'}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">平台 <span className="required">*</span></label>
              <select
                className="form-input"
                value={form.platform}
                onChange={(e) => onChange({ ...form, platform: e.target.value })}
              >
                <option value="alipay">支付宝</option>
                <option value="cmb">招行</option>
                <option value="ths">同花顺</option>
              </select>
              {errors.platform && <div className="form-error">{errors.platform}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">资产类型 <span className="required">*</span></label>
              <select
                className="form-input"
                value={form.asset_type}
                onChange={(e) => onChange({ ...form, asset_type: e.target.value })}
              >
                <option value="fund">基金</option>
                <option value="stock">股票</option>
                <option value="deposit">定期理财</option>
              </select>
              {errors.asset_type && <div className="form-error">{errors.asset_type}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">代码 <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={form.code}
                onChange={(e) => onChange({ ...form, code: e.target.value })}
                placeholder="请输入标的代码"
              />
              {errors.code && <div className="form-error">{errors.code}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">名称 <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                placeholder="请输入标的名称"
              />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">持仓数量 <span className="required">*</span></label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={form.quantity}
                onChange={(e) => onChange({ ...form, quantity: parseFloat(e.target.value) || 0 })}
              />
              {errors.quantity && <div className="form-error">{errors.quantity}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">成本价 <span className="required">*</span></label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                value={form.cost_price}
                onChange={(e) => onChange({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
              />
              {errors.cost_price && <div className="form-error">{errors.cost_price}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">当前价</label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                value={form.current_price ?? ''}
                onChange={(e) =>
                  onChange({ ...form, current_price: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="可选"
              />
            </div>
            <div className="form-group">
              <label className="form-label">行业</label>
              <input
                type="text"
                className="form-input"
                value={form.industry ?? ''}
                onChange={(e) => onChange({ ...form, industry: e.target.value || null })}
                placeholder="可选"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">买入日期</label>
              <input
                type="date"
                className="form-input"
                value={form.buy_date ?? ''}
                onChange={(e) => onChange({ ...form, buy_date: e.target.value || null })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">备注</label>
              <input
                type="text"
                className="form-input"
                value={form.notes ?? ''}
                onChange={(e) => onChange({ ...form, notes: e.target.value || null })}
                placeholder="可选"
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn btn-primary" onClick={onSubmit}>
            {editing ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}