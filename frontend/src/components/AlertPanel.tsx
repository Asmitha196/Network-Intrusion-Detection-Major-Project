import type { Alert } from '../types'

interface Props {
  alerts: Alert[]
}

const SEVERITY_COLOURS: Record<string, string> = {
  low:      '#6ee7b7',  // green-300
  medium:   '#fde68a',  // yellow-200
  high:     '#fb923c',  // orange-400
  critical: '#f87171',  // red-400
}

/**
 * AlertPanel — scrollable list of the most recent alerts.
 *
 * Each row shows:
 *   • Severity badge (colour-coded)
 *   • Timestamp
 *   • Attack type (or "Anomaly" for stage 2)
 *   • Confidence percentage
 *   • Source IP → Destination IP
 *
 * TODO:
 *   - Make each row clickable → navigate to /alerts/:id for full SHAP detail
 *   - Add column-header sort controls
 *   - Add a severity filter dropdown
 */
export default function AlertPanel({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.heading}>Recent Alerts</h2>
        <p style={styles.empty}>No alerts yet — waiting for traffic...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Recent Alerts ({alerts.length})</h2>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Severity</th>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Confidence</th>
              <th style={styles.th}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} style={styles.row}>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background: SEVERITY_COLOURS[alert.severity] ?? '#94a3b8',
                    }}
                  >
                    {alert.severity.toUpperCase()}
                  </span>
                </td>
                <td style={styles.td}>
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </td>
                <td style={styles.td}>
                  {alert.attack_type ?? 'Anomaly (zero-day)'}
                </td>
                <td style={styles.td}>
                  {(alert.confidence * 100).toFixed(1)}%
                </td>
                <td style={styles.td}>Stage {alert.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1e2230',
    borderRadius: 8,
    padding: '16px',
    border: '1px solid #2d3448',
  },
  heading: {
    fontSize: 14,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 12,
  },
  empty: { color: '#64748b', fontSize: 13 },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '6px 10px',
    borderBottom: '1px solid #2d3448',
    color: '#64748b',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  td: { padding: '7px 10px', borderBottom: '1px solid #1a1f2e', whiteSpace: 'nowrap' },
  row: { transition: 'background 0.1s' },
  badge: {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    color: '#0f1117',
  },
}
