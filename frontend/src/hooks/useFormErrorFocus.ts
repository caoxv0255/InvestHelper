/**
 * useFormErrorFocus — form validation 错误时 focus 第一个错误字段
 *
 * 调用 setErrors 后，调一次 focusFirstError(newErrors)，
 * 配合 form input 的 data-field="<name>" 属性。
 *
 * 用法：
 *   if (Object.keys(newErrors).length > 0) {
 *     form.setErrors(newErrors)
 *     focusFirstError(newErrors)
 *     return
 *   }
 */
export const focusFirstError = (errors: Record<string, unknown>) => {
  const firstError = Object.keys(errors)[0]
  if (!firstError) return
  const el = document.querySelector<HTMLElement>(
    `[data-field="${firstError}"]`,
  )
  el?.focus()
}
