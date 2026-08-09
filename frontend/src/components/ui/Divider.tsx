import { forwardRef, type HTMLAttributes } from 'react'

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical'
}

/**
 * Divider — Phase UI-2 primitive.
 *
 * Thin separator using --color-border-default.
 * Horizontal: section break. Vertical: inline separator.
 */
export const Divider = forwardRef<HTMLHRElement, DividerProps>(
  function Divider({ orientation = 'horizontal', className, ...rest }, ref) {
    return (
      <hr
        ref={ref}
        className={[
          'ds-divider',
          orientation === 'vertical' && 'ds-divider--vertical',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
    )
  },
)
