/**
 * DepositFormModal — Phase C (Portfolio migration)
 *
 * 定期理财新增/编辑表单弹窗. Migrated to <Modal> + <Input> + <Select> + <Button>
 * primitives. All Phase 1 patches preserved:
 *   - useForm + focusFirstError (validation + first-error focus)
 *   - useAutoFocus (modal open → first input auto-focused)
 *   - calcExpectedReturn auto-calc on field blur
 *   - Enter 提交 / Esc 取消
 */
import { useEffect, type FormEvent, type KeyboardEvent } from 'react'
import type { Deposit, DepositCreate } from '../../../types'
import { useForm, focusFirstError, useAutoFocus } from '../../../hooks'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Button } from '../../../components/ui/Button'

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

const BANK_OPTIONS = [
  { value: 'cmb', label: '招商银行' },
  { value: 'icbc', label: '工商银行' },
  { value: 'ccb', label: '建设银行' },
  { value: 'abc', label: '农业银行' },
  { value: 'boc', label: '中国银行' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: '持有中' },
  { value: 'matured', label: '已到期' },
]

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

const parseDecimal = (v: string): number => {
  if (v === '' || v === '.') return 0
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
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

  // modal 打开时 auto-focus 第一个可编辑元素
  useAutoFocus(visible)

  const { values, errors, setField } = form

  const handleSubmit = () => {
    const newErrors = validate(values)
    if (Object.keys(newErrors).length > 0) {
      form.setErrors(newErrors)
      focusFirstError(newErrors)
      return
    }
    onSubmit(values)
  }

  const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (!submitting) onCancel()
    }
  }

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSubmit()
  }

  const autoCalculate = () => {
    const v = calcExpectedReturn(values)
    if (v !== null) {
      setField('expected_return', v)
    }
  }

  const rowStyle = { display: 'flex', gap: 'var(--space-3)' }

  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title={editing ? '编辑定期理财' : '添加定期理财'}
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? editing
                ? '保存中...'
                : '创建中...'
              : editing
                ? '保存'
                : '创建'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={handleFormSubmit}
        onKeyDown={handleFormKeyDown}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
      >
        <div style={rowStyle}>
          <Select
            label="银行 *"
            options={BANK_OPTIONS}
            value={values.bank}
            onChange={(e) => setField('bank', e.target.value)}
            error={errors.bank}
          />
          <Input
            label="产品名称 *"
            type="text"
            value={values.product_name}
            onChange={(e) => setField('product_name', e.target.value)}
            placeholder="请输入产品名称"
            error={errors.product_name}
          />
        </div>

        <div style={rowStyle}>
          <Input
            label="本金 *"
            type="text"
            inputMode="decimal"
            value={values.principal === 0 ? '' : String(values.principal)}
            onChange={(e) => setField('principal', parseDecimal(e.target.value))}
            onBlur={autoCalculate}
            placeholder="0.00"
            error={errors.principal}
          />
          <Input
            label="年化利率(%) *"
            type="text"
            inputMode="decimal"
            value={values.annual_rate === 0 ? '' : String(values.annual_rate)}
            onChange={(e) => setField('annual_rate', parseDecimal(e.target.value))}
            onBlur={autoCalculate}
            placeholder="0.00"
            error={errors.annual_rate}
          />
        </div>

        <div style={rowStyle}>
          <Input
            label="起息日 *"
            type="date"
            value={values.start_date}
            onChange={(e) => setField('start_date', e.target.value)}
            onBlur={autoCalculate}
            error={errors.start_date}
          />
          <Input
            label="到期日 *"
            type="date"
            value={values.maturity_date}
            onChange={(e) => setField('maturity_date', e.target.value)}
            onBlur={autoCalculate}
            error={errors.maturity_date}
          />
        </div>

        <div style={rowStyle}>
          <Input
            label="预期收益"
            type="text"
            inputMode="decimal"
            value={values.expected_return === 0 ? '' : String(values.expected_return)}
            onChange={(e) => setField('expected_return', parseDecimal(e.target.value))}
            placeholder="0.00"
          />
          <Select
            label="状态"
            options={STATUS_OPTIONS}
            value={values.status}
            onChange={(e) => setField('status', e.target.value)}
          />
        </div>

        <Input
          label="备注"
          type="text"
          value={values.notes ?? ''}
          onChange={(e) => setField('notes', e.target.value || null)}
          placeholder="可选"
        />
      </form>
    </Modal>
  )
}

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
