/**
 * useForm — 通用表单状态 hook
 *
 * 替换 `{ values, errors }` 双 useState 模式。
 * setField() 在写入时会自动清除该字段的 error，匹配常见的"用户改正后立即清错"UX。
 * validate() 留给调用方按业务规则写（不同表单规则差异大，不强行抽象）。
 *
 * 示例：
 *   const form = useForm<HoldingCreate>(INITIAL_HOLDING)
 *   form.setField('code', '600519')
 *   form.setError('code', '代码不能为空')
 *   form.reset()  // 回到 INITIAL_HOLDING 并清错
 */
import { useCallback, useState } from 'react'

export type FormErrors<T> = Partial<Record<keyof T, string>>

export interface FormState<T> {
  values: T
  errors: FormErrors<T>
  /** 写值并自动清除该字段 error */
  setField: <K extends keyof T>(field: K, value: T[K]) => void
  /** 设置单个字段错误 */
  setError: <K extends keyof T>(field: K, msg: string) => void
  /** 清除单个字段错误 */
  clearError: <K extends keyof T>(field: K) => void
  /** 整体替换 values（不联动 errors） */
  setValues: (next: T) => void
  /** 整体替换 errors（不联动 values） */
  setErrors: (next: FormErrors<T>) => void
  /** 回到初始 values（或指定 next）并清空 errors */
  reset: (next?: T) => void
}

export function useForm<T extends object>(initial: T): FormState<T> {
  const [values, setValuesState] = useState<T>(initial)
  const [errors, setErrorsState] = useState<FormErrors<T>>({})

  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }))
    setErrorsState((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const setError = useCallback(<K extends keyof T>(field: K, msg: string) => {
    setErrorsState((prev) => ({ ...prev, [field]: msg }))
  }, [])

  const clearError = useCallback(<K extends keyof T>(field: K) => {
    setErrorsState((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const setValues = useCallback((next: T) => setValuesState(next), [])
  const setErrors = useCallback((next: FormErrors<T>) => setErrorsState(next), [])

  const reset = useCallback(
    (next?: T) => {
      setValuesState(next ?? initial)
      setErrorsState({})
    },
    [initial],
  )

  return { values, errors, setField, setError, clearError, setValues, setErrors, reset }
}