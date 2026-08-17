import { forwardRef, useEffect, type ReactNode } from 'react'

export type ModalSize = 'sm' | 'md' | 'lg'

export interface ModalProps {
  visible: boolean
  onClose: () => void
  title: string
  size?: ModalSize
  /** disable overlay close + ESC (for submission state) */
  dismissible?: boolean
  footer?: ReactNode
  children: ReactNode
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'ds-modal-content--sm',
  md: '',
  lg: 'ds-modal-content--lg',
}

/**
 * Modal — Phase UI-B primitive.
 *
 * Replaces 7 inline .modal-* implementations (6 in
 * features/portfolio + 1 in features/news). Token-only; uses
 * existing --radius-lg + --shadow-modal.
 *
 * Patterns preserved from legacy code:
 * - Early-return: parent can render <Modal visible={...}> and
 *   component returns null when !visible (matches Portfolio modals).
 * - dismissible=false disables overlay click + ESC (used during
 *   submission to prevent accidental close).
 *
 * API differs from .modal-* CSS classes:
 * - title + close are managed inside Modal (header is opinionated)
 * - footer is a slot (ReactNode), not a styled region
 */
export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    visible,
    onClose,
    title,
    size = 'md',
    dismissible = true,
    footer,
    children,
  },
  ref,
) {
  useEffect(() => {
    if (!visible || !dismissible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [visible, dismissible, onClose])

  if (!visible) return null

  const handleOverlayClick = () => {
    if (dismissible) onClose()
  }

  const sizeClass = SIZE_CLASS[size]

  return (
    <div className="ds-modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={ref}
        className={['ds-modal-content', sizeClass].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="ds-modal-header">
          <h3 className="ds-modal-title">{title}</h3>
          <button
            className="ds-modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close"
            disabled={!dismissible}
          >
            ×
          </button>
        </div>
        <div className="ds-modal-body">{children}</div>
        {footer && <div className="ds-modal-footer">{footer}</div>}
      </div>
    </div>
  )
})
