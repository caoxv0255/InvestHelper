/**
 * HoldingFormModal — Phase C (Portfolio migration)
 *
 * 持仓新增/编辑表单弹窗. Migrated to <Modal> + <Input> + <Select> + <Button>
 * primitives. All Phase 1 patches preserved:
 *   - useForm + focusFirstError (validation + first-error focus)
 *   - useAutoFocus (modal open → first input auto-focused)
 *   - searchStocks (code → name auto-link, debounce 300ms)
 *   - Enter 提交 / Esc 取消 (via <form onSubmit> + Modal onClose)
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Holding, HoldingCreate } from '../../../types'
import { useForm, focusFirstError, useAutoFocus } from '../../../hooks'
import { searchStocks } from '../../../api/market'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Button } from '../../../components/ui/Button'

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

const PLATFORM_OPTIONS = [
  { value: 'alipay', label: '支付宝' },
  { value: 'cmb', label: '招行' },
  { value: 'ths', label: '同花顺' },
]

const ASSET_TYPE_OPTIONS = [
  { value: 'fund', label: '基金' },
  { value: 'stock', label: '股票' },
  { value: 'deposit', label: '定期理财' },
]

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

// Helper: parse decimal input, allowing '' / '.' as 0 or null
const parseDecimal = (v: string): number | null => {
  if (v === '' || v === '.') return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
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
      setLastAutoFilledCode('')
    }
  }, [visible, editing?.id, form.reset])

  // modal 打开时 auto-focus 第一个可编辑元素
  useAutoFocus(visible)

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
        if (myReq !== reqIdRef.current) return
        const match = res.list.find((r) => r.code === code)
        if (match && form.values.name.trim() === '') {
          form.setField('name', match.name)
        }
        setLastAutoFilledCode(code)
      } catch {
        setLastAutoFilledCode(code)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [visible, editing, form.values.code, form.values.name, lastAutoFilledCode, form.setField])

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

  // Enter 提交 / Esc 取消 — form 内 input/select 触发
  const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (!submitting) onCancel()
    }
    // Enter: native form submit handles via onSubmit handler
  }

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSubmit()
  }

  const rowStyle: React.CSSProperties = { display: 'flex', gap: 'var(--space-3)' }
  const rowStack: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  }

  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title={editing ? '编辑持仓' : '添加持仓'}
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
            label="平台 *"
            options={PLATFORM_OPTIONS}
            value={values.platform}
            onChange={(e) => setField('platform', e.target.value)}
            error={errors.platform}
          />
          <Select
            label="资产类型 *"
            options={ASSET_TYPE_OPTIONS}
            value={values.asset_type}
            onChange={(e) => setField('asset_type', e.target.value)}
            error={errors.asset_type}
          />
        </div>

        <div style={rowStyle}>
          <Input
            label="代码 *"
            type="text"
            value={values.code}
            onChange={(e) => setField('code', e.target.value)}
            placeholder="请输入标的代码"
            error={errors.code}
          />
          <Input
            label="名称 *"
            type="text"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="请输入标的名称"
            error={errors.name}
          />
        </div>

        <div style={rowStyle}>
          <Input
            label="持仓数量 *"
            type="text"
            inputMode="decimal"
            value={values.quantity === 0 ? '' : String(values.quantity)}
            onChange={(e) => {
              const v = parseDecimal(e.target.value)
              setField('quantity', v === null ? 0 : v)
            }}
            placeholder="0.00"
            error={errors.quantity}
          />
          <Input
            label="成本价 *"
            type="text"
            inputMode="decimal"
            value={values.cost_price === 0 ? '' : String(values.cost_price)}
            onChange={(e) => {
              const v = parseDecimal(e.target.value)
              setField('cost_price', v === null ? 0 : v)
            }}
            placeholder="0.0000"
            error={errors.cost_price}
          />
        </div>

        <div style={rowStyle}>
          <Input
            label="当前价"
            type="text"
            inputMode="decimal"
            value={values.current_price == null ? '' : String(values.current_price)}
            onChange={(e) => {
              const v = parseDecimal(e.target.value)
              setField('current_price', v)
            }}
            placeholder="可选"
          />
          <Input
            label="行业"
            type="text"
            value={values.industry ?? ''}
            onChange={(e) => setField('industry', e.target.value || null)}
            placeholder="可选"
          />
        </div>

        <div style={rowStyle}>
          <div style={rowStack}>
            <Input
              label="买入日期"
              type="date"
              value={values.buy_date ?? ''}
              onChange={(e) => setField('buy_date', e.target.value || null)}
            />
          </div>
          <Input
            label="备注"
            type="text"
            value={values.notes ?? ''}
            onChange={(e) => setField('notes', e.target.value || null)}
            placeholder="可选"
          />
        </div>
      </form>
    </Modal>
  )
}
