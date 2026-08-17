/**
 * DeleteConfirmModal — Phase C (Portfolio migration)
 *
 * 删除确认弹窗（持仓/定期通用）。Migrated to <Modal> + <Button> primitives.
 * State ownership: parent owns visible + submitting + onCancel/onConfirm.
 */
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'

export interface DeleteTarget {
  type: 'holding' | 'deposit'
  id: number
  name: string
}

export interface DeleteConfirmModalProps {
  visible: boolean
  target: DeleteTarget | null
  /** 父组件正在删除（用于按钮 disable + loading 文案） */
  submitting?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export const DeleteConfirmModal = ({
  visible,
  target,
  submitting = false,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) => {
  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title="确认删除"
      size="sm"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            取消
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={submitting}>
            {submitting ? '删除中...' : '删除'}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>确定要删除「{target?.name}」吗？</p>
      <p
        style={{
          margin: 'var(--space-2) 0 0 0',
          color: 'var(--color-warning)',
          fontSize: 'var(--font-sm)',
        }}
      >
        此操作不可恢复，请谨慎操作。
      </p>
    </Modal>
  )
}
