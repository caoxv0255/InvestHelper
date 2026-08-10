import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  /** Right-aligned action buttons (typically + Add / Refresh) */
  actions?: ReactNode
  /** Optional subtitle / description below title */
  description?: string
  /** Optional content below header (e.g. tabs, breadcrumbs, filters) */
  children?: ReactNode
}

/**
 * PageHeader — Phase UI-B primitive.
 *
 * Replaces <h1 className="page-title"> + <div className="page-container">
 * pattern across 9 pages. Token-only; uses existing --font-2xl.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │  Title                       [Actions slot]  │
 *   │  Description (optional)                      │
 *   │  [children — e.g. tabs / filters]            │
 *   └──────────────────────────────────────────────┘
 */
export function PageHeader({
  title,
  actions,
  description,
  children,
}: PageHeaderProps) {
  return (
    <header className="ds-page-header">
      <div className="ds-page-header-main">
        <h1 className="ds-page-header-title">{title}</h1>
        {actions && <div className="ds-page-header-actions">{actions}</div>}
      </div>
      {description && (
        <p className="ds-page-header-description">{description}</p>
      )}
      {children}
    </header>
  )
}
