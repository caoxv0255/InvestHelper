/**
 * TpSlModal — Phase C (Portfolio migration)
 *
 * 止盈止损设置弹窗. Migrated to <Modal> + <Input> + <Button> primitives.
 * Internal useState for form + loading preserved (parent owns API calls).
 */
import type { Holding } from '../../../types'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'

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

const formRowStyle = { display: 'flex', gap: 'var(--space-3)' }

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
  return (
    <Modal
      visible={visible && !!holding}
      onClose={onClose}
      title={holding ? `设置止盈止损 - ${holding.name}` : '设置止盈止损'}
      size="md"
      dismissible={!loading}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={loading}
          >
            {loading ? '保存中...' : '保存'}
          </Button>
        </>
      }
    >
      {holding && (
        <>
          <div style={formRowStyle}>
            <Input
              label="成本价"
              type="text"
              inputMode="decimal"
              value={String(holding.cost_price)}
              disabled
            />
            <Input
              label="当前价"
              type="text"
              inputMode="decimal"
              value={String(holding.current_price ?? holding.cost_price)}
              disabled
            />
          </div>
          <div style={{ ...formRowStyle, marginTop: 'var(--space-3)' }}>
            <Input
              label="止盈价"
              type="text"
              inputMode="decimal"
              value={form.take_profit_price}
              onChange={(e) =>
                onChange({ ...form, take_profit_price: e.target.value })
              }
              placeholder="高于当前价"
            />
            <Input
              label="止损价"
              type="text"
              inputMode="decimal"
              value={form.stop_loss_price}
              onChange={(e) =>
                onChange({ ...form, stop_loss_price: e.target.value })
              }
              placeholder="低于当前价"
            />
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button
              variant="ghost"
              onClick={onAutoCalculate}
              disabled={loading}
            >
              {loading ? '计算中...' : '基于 ATR 自动计算'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
