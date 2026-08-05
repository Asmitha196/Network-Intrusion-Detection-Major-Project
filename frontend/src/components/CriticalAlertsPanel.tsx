import React from 'react'
import type { Alert } from '../types'

interface CriticalAlertsPanelProps {
  alerts: Alert[]
  onSelectAlert: (alert: Alert) => void
}

export const CriticalAlertsPanel: React.FC<CriticalAlertsPanelProps> = ({ alerts, onSelectAlert }) => {
  const criticals = alerts.filter(a => a.severity.toLowerCase() === 'critical').slice(0, 5)

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.title}>Latest Critical Incidents</h3>
        <span style={styles.badge}>{criticals.length} High Priority</span>
      </div>

      <div style={styles.list}>
        {criticals.length === 0 ? (
          <div style={styles.emptyText}>No critical severity threats detected.</div>
        ) : (
          criticals.map((alert) => (
            <div key={alert.id} style={styles.item} onClick={() => onSelectAlert(alert)}>
              <div style={styles.itemLeft}>
                <span style={styles.criticalDot} />
                <div>
                  <div style={styles.attackName}>{alert.attack_type || 'Anomaly (Stage 2)'}</div>
                  <div style={styles.flowInfo}>
                    {alert.src_ip || '192.168.10.50'} → {alert.dst_ip || '172.16.0.5'}
                  </div>
                </div>
              </div>

              <div style={styles.itemRight}>
                <span style={styles.confScore}>{(alert.confidence * 100).toFixed(0)}% Conf.</span>
                <span style={styles.arrowBtn}>→</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#0d1117',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '16px 20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#ef4444',
  },
  badge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  emptyText: {
    color: '#6e7681',
    fontSize: '12px',
    padding: '16px 0',
    textAlign: 'center',
  },
  item: {
    backgroundColor: '#161b22',
    border: '1px solid #21262d',
    borderRadius: '6px',
    padding: '10px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  criticalDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
  },
  attackName: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  flowInfo: {
    fontSize: '11px',
    color: '#8b949e',
    fontFamily: 'monospace',
  },
  itemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  confScore: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#ef4444',
  },
  arrowBtn: {
    color: '#58a6ff',
    fontSize: '12px',
  },
}

export default CriticalAlertsPanel
