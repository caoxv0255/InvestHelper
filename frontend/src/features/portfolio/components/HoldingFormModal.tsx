/**
 * 持仓新增/编辑表单弹窗
 *
 * 表单状态、错误、校验全部内化（useForm）。
 * 父组件只需传 visible + editing + onCancel + onSubmit(values)。
 *
 * 打开时（visible false→true 或 editing.id 变化）会自动 reset 表单。
 */
import { useEffect } from 'react'
import type { Holding, HoldingCreate } from '../../../types'
import { useForm } from '../../../hooks'

const INITIAL_HOLDING: HoldingCreate = {
  platform: 'alipay',
  asset_type: 'fund',
  code: '',
  name: '',
  quantity: 0,
  cost_price: 0,
  current_price: null,
  take_profit_price: null,
  stop_loss_price: null,
  industry: null,
  buy_date: null,
  notes: null,
}

const holdingFromEditing = (h: Holding): HoldingCreate => ({
  platform: h.platform,
  asset_type: h.asset_type,
  code: h.code,
  name: h.name,
  quantity: h.quantity,
  cost_price: h.cost_price,
  current_price: h.current_price,
  take_profit_price: h.take_profit_price,
  stop_loss_price: h.stop_loss_price,
  industry: h.industry,
  buy_date: h.buy_date,
  notes: h.notes,
})

const validate = (form: HoldingCreate): Partial<Record<keyof HoldingCreate, string>> => {
  const errors: Partial<Record<keyof HoldingCreate, string>> = {}
  if (!form.platform) errors.platform = '请选择平台'
  if (!form.asset_type) errors.asset_type = '请选择资产类型'
  if (!form.code.trim()) errors.code = '请输入代码'
  if (!form.name.trim()) errors.name = '请输入名称'
  if (form.quantity <= 0) errors.quantity = '持仓数量必须大于0'
  if (form.cost_price <= 0) errors.cost_price = '成本价必须大于0'
  return errors
}

export interface HoldingFormModalProps {
  visible: boolean
  editing: Holding | null
  onCancel: () => void
  /** 通过校验后回调，父组件只负责调 API */
  onSubmit: (values: HoldingCreate) => void
}

export const HoldingFormModal = ({
  visible,
  editing,
  onCancel,
  onSubmit,
}: HoldingFormModalProps) => {
  const form = useForm<HoldingCreate>(INITIAL_HOLDING)

  // 每次打开或切换编辑对象时重置表单
  useEffect(() => {
    if (visible) {
      form.reset(editing ? holdingFromEditing(editing) : INITIAL_HOLDING)
    }
  }, [visible, editing?.id, form.reset])

  if (!visible) return null

  const { values, errors, setField } = form

  const handleSubmit = () => {
    const newErrors = validate(values)
    if (Object.keys(newErrors).length > 0) {
      form.setErrors(newErrors)
      return
    }
    onSubmit(values)
  }

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
                value={values.platform}
                onChange={(e) => setField('platform', e.target.value)}
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
                value={values.asset_type}
                onChange={(e) => setField('asset_type', e.target.value)}
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
                value={values.code}
                onChange={(e) => setField('code', e.target.value)}
                placeholder="请输入标的代码"
              />
              {errors.code && <div className="form-error">{errors.code}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">名称 <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={values.name}
                onChange={(e) => setField('name', e.target.value)}
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
                value={values.quantity}
                onChange={(e) => setField('quantity', parseFloat(e.target.value) || 0)}
              />
              {errors.quantity && <div className="form-error">{errors.quantity}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">成本价 <span className="required">*</span></label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                value={values.cost_price}
                onChange={(e) => setField('cost_price', parseFloat(e.target.value) || 0)}
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
                value={values.current_price ?? ''}
                onChange={(e) =>
                  setField('current_price', e.target.value ? parseFloat(e.target.value) : null)
                }
                placeholder="可选"
              />
            </div>
            <div className="form-group">
              <label className="form-label">行业</label>
              <input
                type="text"
                className="form-input"
                value={values.industry ?? ''}
                onChange={(e) => setField('industry', e.target.value || null)}
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
                value={values.buy_date ?? ''}
                onChange={(e) => setField('buy_date', e.target.value || null)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">备注</label>
              <input
                type="text"
                className="form-input"
                value={values.notes ?? ''}
                onChange={(e) => setField('notes', e.target.value || null)}
                placeholder="可选"
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {editing ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}