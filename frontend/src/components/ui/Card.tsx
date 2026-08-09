import { forwardRef, type HTMLAttributes } from 'react'

export type CardVariant = 'default' | 'bordered'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

/**
 * Card — Phase UI-2 layout primitive.
 *
 * Pure container. No header/footer slots; layout via children.
 * variant=bordered for use inside another surface (no shadow).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={[
        'ds-card',
        variant === 'bordered' && 'ds-card--bordered',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
})
