import React, { useState } from 'react'
import type { Alert, SeverityLevel } from '../types'

interface RecentAlertsTableProps {
  alerts: Alert[]
  onSelectAlert: (alert: Alert) => void
}

export const RecentAlertsTable: React.FC<RecentAlertsTableProps> = ({ alerts, onSelectAlert }) => {
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity.toLowerCase() !== severityFilter.toLowerCase()) {
      return false
    }
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase()
      const matchIp = (a.src_ip ?? '').toLowerCase().includes(term) || (a.dst_ip ?? '').toLowerCase().includes(term)
      const matchAttack = (a.attack_type ?? '').toLowerCase().includes(term)
      const matchProto = (a.protocol ?? '').toLowerCase().includes(term)
      if (!matchIp && !matchAttack && !matchProto) return false
    }
    return true
  })

  const getSeverityStyle = (sev: SeverityLevel) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444' }
      case 'high':
        return { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid #f97316' }
      case 'medium':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #f59e0b' }
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981' }
    }
  }

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return ts
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.title}>Recent Security Alerts</h3>
          <span style={styles.subtitle}>Real-time stream & historical incident log</span>
        </div>

        <div style={styles.filterBar}>
          <input
            type="text"
            placeholder="Search IP, attack..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={styles.selectInput}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Source IP → Destination IP</th>
              <th style={styles.th}>Protocol</th>
              <th style={styles.th}>Stage</th>
              <th style={styles.th}>Attack Classification</th>
              <th style={styles.th}>Severity</th>
              <th style={styles.th}>Confidence</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={8} style={styles.emptyTd}>
                  No alerts match the selected criteria.
                </td>
              </tr>
            ) : (
              filteredAlerts.map((alert) => {
                const sevStyle = getSeverityStyle(alert.severity)
                return (
                  <tr
                    key={alert.id}
                    style={styles.tr}
                    onClick={() => onSelectAlert(alert)}
                  >
                    <td style={styles.td}>{formatTimestamp(alert.timestamp)}</td>
                    <td style={styles.td}>
                      <span style={styles.ipText}>{alert.src_ip || '192.168.10.50'}</span>
                      <span style={styles.arrow}>→</span>
                      <span style={styles.ipText}>{alert.dst_ip || '172.16.0.5'}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.protoBadge}>{alert.protocol || 'TCP'}</span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.stageBadge,
                          backgroundColor: alert.stage === 1 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                          color: alert.stage === 1 ? '#3b82f6' : '#a855f7',
                        }}
                      >
                        Stage {alert.stage} {alert.stage === 1 ? '(Classifier)' : '(Autoencoder)'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <strong style={{ color: '#f0f6fc' }}>
                        {alert.attack_type || 'Anomaly (Zero-Day)'}
                      </strong>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.sevBadge, ...sevStyle }}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.confidenceBarContainer}>
                        <div
                          style={{
                            ...styles.confidenceBarFill,
                            width: `${Math.round((alert.confidence || 0) * 100)}%`,
                            backgroundColor: alert.confidence > 0.8 ? '#ef4444' : '#f59e0b',
                          }}
                        />
                        <span style={styles.confidenceText}>
                          {(alert.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <button
                        style={styles.detailsBtn}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectAlert(alert)
                        }}
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '16px 20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  subtitle: {
    fontSize: '12px',
    color: '#8b949e',
  },
  filterBar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  searchInput: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#f0f6fc',
    padding: '6px 12px',
    fontSize: '12px',
    outline: 'none',
  },
  selectInput: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#f0f6fc',
    padding: '6px 12px',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  th: {
    padding: '10px 12px',
    borderBottom: '1px solid #30363d',
    color: '#8b949e',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid #21262d',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '12px',
    color: '#c9d1d9',
  },
  emptyTd: {
    padding: '30px',
    textAlign: 'center',
    color: '#6e7681',
  },
  ipText: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#58a6ff',
  },
  arrow: {
    margin: '0 6px',
    color: '#6e7681',
  },
  protoBadge: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontFamily: 'monospace',
  },
  stageBadge: {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
  },
  sevBadge: {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  confidenceBarContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100px',
  },
  confidenceBarFill: {
    height: '6px',
    borderRadius: '3px',
  },
  confidenceText: {
    fontSize: '11px',
    color: '#8b949e',
  },
  detailsBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#58a6ff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
}

export default RecentAlertsTable
