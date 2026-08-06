/**
 * KeywordConfigModal — 关键词配置弹窗
 *
 * 关键词列表 + 新关键词输入 + 保存逻辑全部内化。
 * 父组件只传：visible / initialKeywords / onClose / onSaved(nextKeywords)
 */
import { useEffect, useState } from 'react'
import { useForm } from '../../../hooks'
import { updateNewsKeywords } from '../../../api/news'

interface FormShape {
  newKeyword: string
  modalKeywords: string[]
  modalError: string | null
}

interface KeywordConfigModalProps {
  visible: boolean
  initialKeywords: string[]
  onClose: () => void
  /** 保存成功后回调，父组件通常用于刷新高亮关键词 */
  onSaved?: (nextKeywords: string[]) => void
}

const EMPTY_FORM: FormShape = {
  newKeyword: '',
  modalKeywords: [],
  modalError: null,
}

export const KeywordConfigModal = ({
  visible,
  initialKeywords,
  onClose,
  onSaved,
}: KeywordConfigModalProps) => {
  const form = useForm<FormShape>(EMPTY_FORM)
  const [saving, setSaving] = useFormSaveState()

  // 打开时重置
  useEffect(() => {
    if (visible) {
      form.reset({
        newKeyword: '',
        modalKeywords: [...initialKeywords],
        modalError: null,
      })
    }
  }, [visible, initialKeywords, form.reset])

  if (!visible) return null

  const { values, setField } = form
  const { newKeyword, modalKeywords, modalError } = values

  const addKeyword = () => {
    const kw = newKeyword.trim()
    if (!kw) return
    if (modalKeywords.includes(kw)) {
      setField('newKeyword', '')
      return
    }
    setField('modalKeywords', [...modalKeywords, kw])
    setField('newKeyword', '')
  }

  const removeKeyword = (kw: string) => {
    setField(
      'modalKeywords',
      modalKeywords.filter((k) => k !== kw),
    )
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setField('modalError', null)
    try {
      const res = await updateNewsKeywords(modalKeywords)
      const next = res?.keywords ?? modalKeywords
      onSaved?.(next)
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存关键词失败'
      setField('modalError', message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-small"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>关键词设置</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {modalError && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              {modalError}
            </div>
          )}
          <div className="form-group-full">
            <label className="form-label">添加关键词</label>
            <div className="news-keyword-input-row">
              <input
                type="text"
                className="form-input"
                placeholder="输入关键词后回车添加"
                value={newKeyword}
                onChange={(e) => setField('newKeyword', e.target.value)}
                onKeyDown={handleInputKeyDown}
              />
              <button className="btn btn-primary" onClick={addKeyword}>
                添加
              </button>
            </div>
          </div>

          <div className="form-group-full" style={{ marginTop: '1rem' }}>
            <label className="form-label">
              已配置关键词（{modalKeywords.length}）
            </label>
            {modalKeywords.length === 0 ? (
              <div className="text-muted">暂未配置任何关键词</div>
            ) : (
              <div className="news-keyword-tag-list">
                {modalKeywords.map((kw) => (
                  <span key={kw} className="news-keyword-tag removable">
                    {kw}
                    <button
                      className="news-keyword-remove"
                      onClick={() => removeKeyword(kw)}
                      title="删除"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="text-muted" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
            配置的关键词将用于快讯内容高亮展示，不影响后端抓取逻辑。
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 小工具 hook：单一 boolean save state，因为 useForm 不擅长管 saving 这种
 * 跨字段的瞬时状态（既非值也非错）。
 */
function useFormSaveState(): [boolean, (v: boolean) => void] {
  const [saving, setSaving] = useState(false)
  return [saving, setSaving]
}