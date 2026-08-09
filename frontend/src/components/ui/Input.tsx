import { forwardRef, useId, type InputHTMLAttributes } from 'react'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
}

/**
 * Input — Phase UI-2 primitive.
 *
 * Supports inputMode + autoFocus via ...rest (financial apps need
 * decimal input + auto-focus on modal open).
 * Tabular nums applied via CSS for digit alignment.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id: idProp, ...rest },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  const hasError = Boolean(error)

  return (
    <div className="ds-input-wrap">
      {label && (
        <label className="ds-input-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={['ds-input', hasError && 'ds-input--error', className]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
      {error && <span className="ds-input-error">{error}</span>}
    </div>
  )
})
