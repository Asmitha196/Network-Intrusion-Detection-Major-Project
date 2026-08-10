import React from 'react'
import { NavLink } from 'react-router-dom'

interface SidebarProps {
  wsReadyState?: 'connecting' | 'open' | 'closing' | 'closed'
}

export const Sidebar: React.FC<SidebarProps> = ({ wsReadyState = 'connecting' }) => {
  const navItems = [
    { label: 'SOC Dashboard', path: '/', icon: '📊' },
    { label: 'Correlated Incidents', path: '/correlated-incidents', icon: '🔗' },
    { label: 'Attacker Profiles', path: '/attackers', icon: '🎯' },
    { label: 'Honeypot Decoy', path: '/honeypot', icon: '🍯' },
    { label: 'Threat Intel', path: '/threat-intel', icon: '🔍' },
    { label: 'Incident Response', path: '/incident', icon: '🛡️' },
    { label: 'Simulation Lab', path: '/simulation', icon: '🧪' },
    { label: 'Model Evaluation', path: '/evaluation', icon: '🎯' },
    { label: 'Analytics', path: '/analytics', icon: '📈' },
    { label: 'SOC Reports', path: '/reports', icon: '📋' },
    { label: 'Alerts', path: '/alerts', icon: '🚨' },
    { label: 'Live Traffic', path: '/traffic', icon: '🌐' },
    { label: 'PCAP Replay', path: '/replay', icon: '⚡' },
    { label: 'Health & Metrics', path: '/metrics', icon: '⚙️' },
    { label: 'Settings', path: '/settings', icon: '🔧' },
  ]

  const isLive = wsReadyState === 'open'

  return (
    <aside style={styles.sidebar}>
      {/* Brand Logo */}
      <div style={styles.brand}>
        <div style={styles.logoBadge}>SOC</div>
        <div style={styles.brandText}>
          <span style={styles.brandName}>ENTERPRISE SOC</span>
          <span style={styles.brandSub}>SIEM & NIDS Platform</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              ...styles.link,
              backgroundColor: isActive ? '#1f2937' : 'transparent',
              color: isActive ? '#60a5fa' : '#9ca3af',
              borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
            })}
          >
            <span style={styles.icon}>{item.icon}</span>
            <span style={styles.label}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer Connection Status */}
      <div style={styles.footer}>
        <div style={styles.statusBox}>
          <span style={{ ...styles.statusDot, backgroundColor: isLive ? '#10b981' : '#f59e0b' }} />
          <div style={styles.statusInfo}>
            <span style={styles.statusTitle}>{isLive ? 'Stream Connected' : 'Reconnecting...'}</span>
            <span style={styles.statusSub}>WebSocket Engine</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '230px',
    minWidth: '230px',
    height: '100vh',
    backgroundColor: '#0d1117',
    borderRight: '1px solid #21262d',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    overflowY: 'auto',
  },
  brand: {
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid #21262d',
  },
  logoBadge: {
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: '11px',
    padding: '4px 6px',
    borderRadius: '4px',
    letterSpacing: '1px',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandName: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  brandSub: {
    fontSize: '9px',
    color: '#8b949e',
  },
  nav: {
    flex: 1,
    padding: '12px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
  },
  icon: {
    fontSize: '14px',
  },
  label: {
    letterSpacing: '0.2px',
  },
  footer: {
    padding: '12px',
    borderTop: '1px solid #21262d',
  },
  statusBox: {
    backgroundColor: '#161b22',
    border: '1px solid #21262d',
    borderRadius: '6px',
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  statusTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  statusSub: {
    fontSize: '8px',
    color: '#8b949e',
  },
}

export default Sidebar
