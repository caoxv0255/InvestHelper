interface HeaderProps {
  onToggleSidebar?: () => void
}

/**
 * Header — Phase 2 global header
 *
 * Layout:
 *   [☰ (mobile only)]  InvestHelper  ... [user slot reserved]
 */
export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="ds-header">
      <button
        className="ds-header-menu"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
        type="button"
      >
        {/* U+2630 TRIGRAM FOR HEAVEN — Unicode symbol, not emoji */}
        ☰
      </button>
      <div className="ds-header-brand">InvestHelper</div>
      <div className="ds-header-actions">
        {/* reserved for future user / profile widget */}
      </div>
    </header>
  )
}
