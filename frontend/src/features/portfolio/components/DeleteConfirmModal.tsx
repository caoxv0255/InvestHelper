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
  onCancel: () => void
  onConfirm: () => void
}

export const DeleteConfirmModal = ({
  visible,
  target,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) => {
  if (!visible) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>确认删除</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <p>确定要删除「{target?.name}」吗？</p>
          <p className="text-warning">此操作不可恢复，请谨慎操作。</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn btn-danger" onClick={onConfirm}>删除</button>
        </div>
      </div>
    </div>
  )
}