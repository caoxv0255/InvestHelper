/**
 * 定期理财新增/编辑表单弹窗
 *
 * 表单状态、错误、校验、预期收益计算全部内化（useForm）。
 * 父组件只需传 visible + editing + onCancel + onSubmit(values)。
 */
import { useEffect } from 'react'
import type { Deposit, DepositCreate } from '../../../types'
import { useForm } from '../../../hooks'

const initialDeposit = (today: string): DepositCreate => ({
  bank: 'cmb',
  product_name: '',
  principal: 0,
  annual_rate: 0,
  start_date: today,
  maturity_date: today,
  expected_return: 0,
  status: 'active',
  notes: null,
})

const depositFromEditing = (d: Deposit): DepositCreate => ({
  bank: d.bank,
  product_name: d.product_name,
  principal: d.principal,
  annual_rate: d.annual_rate,
  start_date: d.start_date,
  maturity_date: d.maturity_date,
  expected_return: d.expected_return,
  status: d.status,
  notes: d.notes,
})

const validate = (form: DepositCreate): Partial<Record<keyof DepositCreate, string>> => {
  const errors: Partial<Record<keyof DepositCreate, string>> = {}
  if (!form.bank) errors.bank = '请选择银行'
  if (!form.product_name.trim()) errors.product_name = '请输入产品名称'
  if (form.principal <= 0) errors.principal = '本金必须大于0'
  if (form.annual_rate <= 0) errors.annual_rate = '利率必须大于0'
  if (!form.start_date) errors.start_date = '请选择起息日'
  if (!form.maturity_date) errors.maturity_date = '请选择到期日'
  if (form.start_date && form.maturity_date && form.start_date >= form.maturity_date) {
    errors.maturity_date = '到期日必须晚于起息日'
  }
  return errors
}

/** 本金 × 年化 × (天数/365) 取两位小数 */
const calcExpectedReturn = (form: DepositCreate): number | null => {
  if (
    form.principal > 0 &&
    form.annual_rate > 0 &&
    form.start_date &&
    form.maturity_date
  ) {
    const start = new Date(form.start_date)
    const end = new Date(form.maturity_date)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const expected = (form.principal * form.annual_rate / 100) * (days / 365)
    return Math.round(expected * 100) / 100
  }
  return null
}

export interface DepositFormModalProps {
  visible: boolean
  editing: Deposit | null
  /** 父组件正在提交（用于按钮 disable + loading 文案） */
  submitting?: boolean
  onCancel: () => void
  /** 通过校验后回调，父组件只负责调 API */
  onSubmit: (values: DepositCreate) => void
}

export const DepositFormModal = ({
  visible,
  editing,
  submitting = false,
  onCancel,
  onSubmit,
}: DepositFormModalProps) => {
  const form = useForm<DepositCreate>(initialDeposit(''))

  useEffect(() => {
    if (visible) {
      form.reset(editing ? depositFromEditing(editing) : initialDeposit(todayIso()))
    }
  }, [visible, editing?.id, form.reset])

  if (!visible) return null

  // submitting 时禁止 overlay click 关闭 modal，避免误触中断请求
  const handleOverlayClick = () => {
    if (submitting) return
    onCancel()
  }

  const { values, errors, setField } = form

  const handleSubmit = () => {
    const newErrors = validate(values)
    if (Object.keys(newErrors).length > 0) {
      form.setErrors(newErrors)
      return
    }
    onSubmit(values)
  }

  const autoCalculate = () => {
    const v = calcExpectedReturn(values)
    if (v !== null) {
      setField('expected_return', v)
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editing ? '编辑定期理财' : '添加定期理财'}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">银行 <span className="required">*</span></label>
              <select
                className="form-input"
                value={values.bank}
                onChange={(e) => setField('bank', e.target.value)}
              >
                <option value="cmb">招商银行</option>
                <option value="icbc">工商银行</option>
                <option value="ccb">建设银行</option>
                <option value="abc">农业银行</option>
                <option value="boc">中国银行</option>
              </select>
              {errors.bank && <div className="form-error">{errors.bank}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">产品名称 <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={values.product_name}
                onChange={(e) => setField('product_name', e.target.value)}
                placeholder="请输入产品名称"
              />
              {errors.product_name && <div className="form-error">{errors.product_name}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">本金 <span className="required">*</span></label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={values.principal === 0 ? '' : String(values.principal)}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || v === '.') {
                    setField('principal', 0)
                  } else {
                    const n = parseFloat(v)
                    setField('principal', Number.isFinite(n) ? n : 0)
                  }
                }}
                onBlur={autoCalculate}
                placeholder="0.00"
              />
              {errors.principal && <div className="form-error">{errors.principal}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">年化利率(%) <span className="required">*</span></label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={values.annual_rate === 0 ? '' : String(values.annual_rate)}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || v === '.') {
                    setField('annual_rate', 0)
                  } else {
                    const n = parseFloat(v)
                    setField('annual_rate', Number.isFinite(n) ? n : 0)
                  }
                }}
                onBlur={autoCalculate}
                placeholder="0.00"
              />
              {errors.annual_rate && <div className="form-error">{errors.annual_rate}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">起息日 <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={values.start_date}
                onChange={(e) => setField('start_date', e.target.value)}
                onBlur={autoCalculate}
              />
              {errors.start_date && <div className="form-error">{errors.start_date}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">到期日 <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={values.maturity_date}
                onChange={(e) => setField('maturity_date', e.target.value)}
                onBlur={autoCalculate}
              />
              {errors.maturity_date && <div className="form-error">{errors.maturity_date}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">预期收益</label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={values.expected_return === 0 ? '' : String(values.expected_return)}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || v === '.') {
                    setField('expected_return', 0)
                  } else {
                    const n = parseFloat(v)
                    setField('expected_return', Number.isFinite(n) ? n : 0)
                  }
                }}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">状态</label>
              <select
                className="form-input"
                value={values.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                <option value="active">持有中</option>
                <option value="matured">已到期</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group form-group-full">
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
          <button className="btn btn-secondary" onClick={onCancel} disabled={submitting}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (editing ? '保存中...' : '创建中...') : (editing ? '保存' : '创建')}
          </button>
        </div>
      </div>
    </div>
  )
}

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}