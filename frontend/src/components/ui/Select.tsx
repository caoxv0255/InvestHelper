import { forwardRef, useId, type SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[]
  label?: string
  error?: string
  placeholder?: string
}

/**
 * Select — Phase UI-2 primitive.
 *
 * Wraps native <select> for accessibility + keyboard support.
 * Inline SVG chevron (not a library); system font handles rendering.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, label, error, placeholder, className, id: idProp, ...rest },
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
      <select
        ref={ref}
        id={id}
        className={[
          'ds-input',
          'ds-select',
          hasError && 'ds-input--error',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="ds-input-error">{error}</span>}
    </div>
  )
})
