import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'ds-btn--primary',
  secondary: 'ds-btn--secondary',
  ghost: 'ds-btn--ghost',
  danger: 'ds-btn--danger',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'ds-btn--sm',
  md: 'ds-btn--md',
}

/**
 * Button — Phase UI-2 primitive.
 *
 * Default type="button" to prevent accidental form submission.
 * forwardRef for form / focus / keyboard-shortcut integration.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      type = 'button',
      className,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={[
          'ds-btn',
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {children}
      </button>
    )
  },
)
