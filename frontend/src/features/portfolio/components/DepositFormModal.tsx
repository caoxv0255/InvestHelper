/**
 * 定期理财新增/编辑表单弹窗
 */
import type { Deposit, DepositCreate } from '../../../types'

export interface DepositFormModalProps {
  visible: boolean
  editing: Deposit | null
  form: DepositCreate
  errors: Record<string, string>
  onChange: (next: DepositCreate) => void
  onCancel: () => void
  onSubmit: () => void
  onBlurCalculate: () => void
}

export const DepositFormModal = ({
  visible,
  editing,
  form,
  errors,
  onChange,
  onCancel,
  onSubmit,
  onBlurCalculate,
}: DepositFormModalProps) => {
  if (!visible) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
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
                value={form.bank}
                onChange={(e) => onChange({ ...form, bank: e.target.value })}
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
                value={form.product_name}
                onChange={(e) => onChange({ ...form, product_name: e.target.value })}
                placeholder="请输入产品名称"
              />
              {errors.product_name && <div className="form-error">{errors.product_name}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">本金 <span className="required">*</span></label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={form.principal}
                onChange={(e) =>
                  onChange({ ...form, principal: parseFloat(e.target.value) || 0 })
                }
                onBlur={onBlurCalculate}
              />
              {errors.principal && <div className="form-error">{errors.principal}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">年化利率(%) <span className="required">*</span></label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={form.annual_rate}
                onChange={(e) =>
                  onChange({ ...form, annual_rate: parseFloat(e.target.value) || 0 })
                }
                onBlur={onBlurCalculate}
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
                value={form.start_date}
                onChange={(e) => onChange({ ...form, start_date: e.target.value })}
                onBlur={onBlurCalculate}
              />
              {errors.start_date && <div className="form-error">{errors.start_date}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">到期日 <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={form.maturity_date}
                onChange={(e) => onChange({ ...form, maturity_date: e.target.value })}
                onBlur={onBlurCalculate}
              />
              {errors.maturity_date && <div className="form-error">{errors.maturity_date}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">预期收益</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={form.expected_return}
                onChange={(e) =>
                  onChange({ ...form, expected_return: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">状态</label>
              <select
                className="form-input"
                value={form.status}
                onChange={(e) => onChange({ ...form, status: e.target.value })}
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