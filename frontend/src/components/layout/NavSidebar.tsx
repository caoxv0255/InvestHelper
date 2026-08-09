import { NavLink } from 'react-router-dom'

interface NavItem {
  path: string
  label: string
  /**
   * First letter used as visual mark on tablet (<1200px).
   * NOTE: Sector Rotation / Strategy Lab / Snapshot all share 'S' — distinguished
   * by group context on desktop, tooltip on hover on tablet.
   */
  letter: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Portfolio',
    items: [
      { path: '/', label: 'Overview', letter: 'O' },
      { path: '/portfolio', label: 'Holdings', letter: 'H' },
      { path: '/transactions', label: 'Transactions', letter: 'T' },
    ],
  },
  {
    label: 'Research',
    items: [
      { path: '/news', label: 'News', letter: 'N' },
      { path: '/opportunities', label: 'Opportunities', letter: 'O' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { path: '/kline', label: 'KLine', letter: 'K' },
      { path: '/risk', label: 'Risk', letter: 'R' },
      { path: '/market-sentiment', label: 'Market Sentiment', letter: 'M' },
      { path: '/sector-rotation', label: 'Sector Rotation', letter: 'S' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { path: '/strategy-lab', label: 'Strategy Lab', letter: 'S' },
      { path: '/portfolio-snapshot', label: 'Snapshot', letter: 'S' },
      { path: '/daily-report', label: 'Daily Report', letter: 'D' },
    ],
  },
]

interface NavSidebarProps {
  open?: boolean
  onClose?: () => void
}

export function NavSidebar({ open = false, onClose }: NavSidebarProps) {
  return (
    <aside
      className="ds-sidebar"
      data-open={open}
      aria-label="Primary navigation"
    >
      <nav className="ds-sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div className="ds-sidebar-group" key={group.label}>
            <div className="ds-sidebar-group-title">{group.label}</div>
            <ul className="ds-sidebar-list">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => {
                      // close mobile drawer after navigation
                      if (window.innerWidth < 768) onClose?.()
                    }}
                    className={({ isActive }) =>
                      `ds-sidebar-item${
                        isActive ? ' ds-sidebar-item--active' : ''
                      }`
                    }
                  >
                    <span
                      className="ds-sidebar-item-letter"
                      aria-hidden="true"
                    >
                      {item.letter}
                    </span>
                    <span className="ds-sidebar-item-label">
                      {item.label}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
