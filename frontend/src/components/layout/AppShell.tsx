import { useState, useEffect, type ReactNode } from 'react'
import { NavSidebar } from './NavSidebar'
import { Header } from './Header'

interface AppShellProps {
  children: ReactNode
}

/**
 * AppShell — Phase 2 layout primitive
 *
 * Structure:
 *   ┌──────────┬───────────────────────┐
 *   │          │  Header               │
 *   │  Sidebar ├───────────────────────┤
 *   │          │                       │
 *   │          │  Content (Routes)     │
 *   │          │                       │
 *   └──────────┴───────────────────────┘
 *
 * Responsive (see shell.css):
 *   ≥1200px  — 240px sidebar with labels
 *   768-1199 — 64px collapsed sidebar (icons only via letter mark)
 *   <768px   — drawer, hamburger in Header
 */
export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // auto-close mobile drawer on browser back/forward
  useEffect(() => {
    const handler = () => setSidebarOpen(false)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  return (
    <div className="ds-shell">
      <NavSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="ds-shell-main">
        <Header onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        <main className="ds-shell-content">{children}</main>
      </div>
    </div>
  )
}
