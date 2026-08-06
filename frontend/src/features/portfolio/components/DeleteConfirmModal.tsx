/**
 * 删除确认弹窗（持仓/定期通用）
 */
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
  if (!visible) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>确认删除</h3>
          <button className="modal-close" onClick={onCancel} disabled={submitting}>×</button>
        </div>
        <div className="modal-body">
          <p>确定要删除「{target?.name}」吗？</p>
          <p className="text-warning">此操作不可恢复，请谨慎操作。</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={submitting}>取消</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={submitting}>
            {submitting ? '删除中...' : '删除'}
          </button>
        </div>
      </div>
    </div>
  )
}