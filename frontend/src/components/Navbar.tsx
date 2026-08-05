import React from 'react'

interface NavbarProps {
  activePage: string
  alertCount?: number
  onRefresh?: () => void
}

export const Navbar: React.FC<NavbarProps> = ({ activePage, alertCount = 0, onRefresh }) => {
  return (
    <header style={styles.navbar}>
      <div style={styles.left}>
        <span style={styles.breadcrumbRoot}>SOC</span>
        <span style={styles.separator}>/</span>
        <span style={styles.breadcrumbCurrent}>{activePage}</span>
      </div>

      <div style={styles.right}>
        {alertCount > 0 && (
          <div style={styles.alertCounter}>
            <span style={styles.alertPulse} />
            <span style={styles.alertText}>{alertCount} New Alerts</span>
          </div>
        )}

        {onRefresh && (
          <button style={styles.refreshBtn} onClick={onRefresh}>
            🔄 Refresh
          </button>
        )}
      </div>
    </header>
  )
}

const styles: Record<string, React.CSSProperties> = {
  navbar: {
    height: '56px',
    backgroundColor: '#0d1117',
    borderBottom: '1px solid #21262d',
    padding: '0 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  breadcrumbRoot: {
    fontSize: '12px',
    color: '#8b949e',
    fontWeight: 600,
  },
  separator: {
    color: '#484f58',
    fontSize: '12px',
  },
  breadcrumbCurrent: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  alertCounter: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    padding: '4px 10px',
    borderRadius: '16px',
  },
  alertPulse: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
  },
  alertText: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#ef4444',
  },
  refreshBtn: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    color: '#c9d1d9',
    padding: '5px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
  },
}

export default Navbar
