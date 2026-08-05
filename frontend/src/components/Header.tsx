import React from 'react'

interface HeaderProps {
  wsReadyState: 'connecting' | 'open' | 'closing' | 'closed'
  onRefresh?: () => void
}

export const Header: React.FC<HeaderProps> = ({ wsReadyState, onRefresh }) => {
  const getStatusBadge = () => {
    switch (wsReadyState) {
      case 'open':
        return { label: 'LIVE FEED ACTIVE', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
      case 'connecting':
        return { label: 'CONNECTING...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
      default:
        return { label: 'OFFLINE / RECONNECTING', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
    }
  }

  const badge = getStatusBadge()

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <div style={styles.logoContainer}>
          <div style={styles.pulseDot} />
          <h1 style={styles.title}>Network Intrusion Detection System</h1>
        </div>
        <span style={styles.subtitle}>Hybrid ML Security Monitoring & Real-time Threat Intelligence</span>
      </div>

      <div style={styles.right}>
        <div style={{ ...styles.badge, color: badge.color, backgroundColor: badge.bg }}>
          <span style={{ ...styles.badgeDot, backgroundColor: badge.color }} />
          {badge.label}
        </div>
        {onRefresh && (
          <button style={styles.refreshBtn} onClick={onRefresh} title="Refresh Data">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 0-11.14L2.5 8" />
            </svg>
            Refresh
          </button>
        )}
      </div>
    </header>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    padding: '16px 24px',
    backgroundColor: '#0d1117',
    borderBottom: '1px solid #21262d',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  pulseDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    boxShadow: '0 0 10px #3b82f6',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: '#f0f6fc',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#8b949e',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    border: '1px solid currentColor',
  },
  badgeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: '#21262d',
    color: '#c9d1d9',
    border: '1px solid #30363d',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
}

export default Header
