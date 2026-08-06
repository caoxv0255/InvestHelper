/**
 * 持仓新增/编辑表单弹窗
 *
 * 表单状态、错误、校验全部内化（useForm）。
 * 父组件只需传 visible + editing + onCancel + onSubmit(values)。
 *
 * 打开时（visible false→true 或 editing.id 变化）会自动 reset 表单。
 *
 * 增强：
 *   - 编辑模式下 code→name 联动禁用（保留原 editing 数据）
 *   - 新增模式下输入 code（≥3 字符）会通过 /api/market/search 自动查名称填入
 *     - 单向：code → name（不反向，避免循环）
 *     - debounce 300ms 避免每键查
 *     - 失败 / 找不到时静默
 *     - 同一 code 只查一次（lastAutoFilledCode 去重）
 */
import { useEffect, useRef, useState } from 'react'
import type { Holding, HoldingCreate } from '../../../types'
import { useForm } from '../../../hooks'
import { searchStocks } from '../../../api/market'

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
  /** 父组件正在提交（用于按钮 disable + loading 文案） */
  submitting?: boolean
  onCancel: () => void
  /** 通过校验后回调，父组件只负责调 API */
  onSubmit: (values: HoldingCreate) => void
}

export const HoldingFormModal = ({
  visible,
  editing,
  submitting = false,
  onCancel,
  onSubmit,
}: HoldingFormModalProps) => {
  const form = useForm<HoldingCreate>(INITIAL_HOLDING)
  const [lastAutoFilledCode, setLastAutoFilledCode] = useState('')
  const reqIdRef = useRef(0)

  // 每次打开或切换编辑对象时重置表单
  useEffect(() => {
    if (visible) {
      form.reset(editing ? holdingFromEditing(editing) : INITIAL_HOLDING)
      setLastAutoFilledCode(editing ? '' : '')
    }
  }, [visible, editing?.id, form.reset])

  // code → name 自动联动（仅新增模式，debounce 300ms，失败静默）
  useEffect(() => {
    if (!visible) return
    if (editing) return
    const code = form.values.code.trim()
    if (code.length < 3) return
    if (code === lastAutoFilledCode) return

    const myReq = ++reqIdRef.current
    const handle = setTimeout(async () => {
      try {
        const res = await searchStocks(code)
        // 防过期响应：如果用户已经又改了 code，丢弃本轮结果
        if (myReq !== reqIdRef.current) return
        const match = res.list.find((r) => r.code === code)
        if (match && form.values.name.trim() === '') {
          form.setField('name', match.name)
        }
        setLastAutoFilledCode(code)
      } catch {
        // 静默失败：market/search 依赖外部数据源，不阻断表单填写
        setLastAutoFilledCode(code)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [visible, editing, form.values.code, form.values.name, lastAutoFilledCode, form.setField])

  if (!visible) return null

  const { values, errors, setField } = form

  // submitting 时禁止 overlay click 关闭 modal，避免误触中断请求
  const handleOverlayClick = () => {
    if (submitting) return
    onCancel()
  }

  const handleSubmit = () => {
    const newErrors = validate(values)
    if (Object.keys(newErrors).length > 0) {
      form.setErrors(newErrors)
      return
    }
    onSubmit(values)
  }

  // Enter 提交，Esc 取消（input 元素触发）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (!submitting) onCancel()
    } else if (e.key === 'Enter' && e.target instanceof HTMLElement) {
      // 排除 textarea / select（select Enter 是切换）
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      // 排除 type=button（虽然 form 内通常没有）
      if (e.target instanceof HTMLInputElement && e.target.type === 'button') return
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <form className="modal-content" onKeyDown={handleKeyDown} onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
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
                type="text"
                inputMode="decimal"
                className="form-input"
                value={values.quantity === 0 ? '' : String(values.quantity)}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || v === '.') {
                    setField('quantity', 0)
                  } else {
                    const n = parseFloat(v)
                    setField('quantity', Number.isFinite(n) ? n : 0)
                  }
                }}
                placeholder="0.00"
              />
              {errors.quantity && <div className="form-error">{errors.quantity}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">成本价 <span className="required">*</span></label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={values.cost_price === 0 ? '' : String(values.cost_price)}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || v === '.') {
                    setField('cost_price', 0)
                  } else {
                    const n = parseFloat(v)
                    setField('cost_price', Number.isFinite(n) ? n : 0)
                  }
                }}
                placeholder="0.0000"
              />
              {errors.cost_price && <div className="form-error">{errors.cost_price}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">当前价</label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={values.current_price == null ? '' : String(values.current_price)}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || v === '.') {
                    setField('current_price', null)
                  } else {
                    const n = parseFloat(v)
                    setField('current_price', Number.isFinite(n) ? n : null)
                  }
                }}
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
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (editing ? '保存中...' : '创建中...') : (editing ? '保存' : '创建')}
          </button>
        </div>
      </form>
    </div>
  )
}