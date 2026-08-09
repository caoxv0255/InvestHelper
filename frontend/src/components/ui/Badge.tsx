import { forwardRef, type HTMLAttributes } from 'react'

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  success: 'ds-badge--success',
  danger: 'ds-badge--danger',
  warning: 'ds-badge--warning',
  info: 'ds-badge--info',
  neutral: 'ds-badge--neutral',
}

/**
 * Badge — Phase UI-2 primitive.
 *
 * Replaces SignalBadge + risk / status / news tags.
 * Variants map to semantic color tokens.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant, className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={['ds-badge', VARIANT_CLASS[variant], className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </span>
  )
})
