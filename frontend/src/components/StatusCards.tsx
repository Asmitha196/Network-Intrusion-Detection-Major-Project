import React from 'react'
import type { SystemHealth, MetricsOverview } from '../types'

interface StatusCardsProps {
  health: SystemHealth | null
  overview: MetricsOverview | null
}

export const StatusCards: React.FC<StatusCardsProps> = ({ health, overview }) => {
  const activeAlerts = overview?.today_alerts ?? 0
  const criticalAlerts = overview?.critical_alerts ?? 0
  const totalFlows = overview?.total_alerts ?? 0
  const wsConnections = health?.active_ws_connections ?? 0

  const dbOk = health?.postgres ?? false
  const redisOk = health?.redis ?? false
  const workerRunning = health?.worker_status === 'running'

  return (
    <div style={styles.container}>
      {/* 1. Active Alerts */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Active Alerts</span>
          <span style={{ ...styles.iconBadge, backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>⚡</span>
        </div>
        <div style={styles.cardValue}>{activeAlerts}</div>
        <div style={styles.cardSubtext}>Recorded today</div>
      </div>

      {/* 2. Critical Alerts */}
      <div style={{ ...styles.card, borderColor: criticalAlerts > 0 ? 'rgba(239, 68, 68, 0.4)' : '#21262d' }}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Critical Alerts</span>
          <span style={{ ...styles.iconBadge, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>🚨</span>
        </div>
        <div style={{ ...styles.cardValue, color: criticalAlerts > 0 ? '#ef4444' : '#f0f6fc' }}>{criticalAlerts}</div>
        <div style={styles.cardSubtext}>High priority action needed</div>
      </div>

      {/* 3. Total Flows / Packets */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Total Flows</span>
          <span style={{ ...styles.iconBadge, backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>📊</span>
        </div>
        <div style={styles.cardValue}>{totalFlows}</div>
        <div style={styles.cardSubtext}>Processed by ML pipeline</div>
      </div>

      {/* 4. Active Connections */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Active Connections</span>
          <span style={{ ...styles.iconBadge, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>🌐</span>
        </div>
        <div style={styles.cardValue}>{wsConnections}</div>
        <div style={styles.cardSubtext}>WebSocket clients connected</div>
      </div>

      {/* 5. Database Status */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Database</span>
          <span style={styles.cardStatusLabel}>PostgreSQL</span>
        </div>
        <div style={styles.cardStatusContainer}>
          <span style={{ ...styles.statusDot, backgroundColor: dbOk ? '#10b981' : '#ef4444' }} />
          <span style={{ ...styles.statusText, color: dbOk ? '#10b981' : '#ef4444' }}>
            {dbOk ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
        <div style={styles.cardSubtext}>PostgreSQL Database</div>
      </div>

      {/* 6. Redis Status */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Redis</span>
          <span style={styles.cardStatusLabel}>Streams</span>
        </div>
        <div style={styles.cardStatusContainer}>
          <span style={{ ...styles.statusDot, backgroundColor: redisOk ? '#10b981' : '#ef4444' }} />
          <span style={{ ...styles.statusText, color: redisOk ? '#10b981' : '#ef4444' }}>
            {redisOk ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
        <div style={styles.cardSubtext}>Message Stream Broker</div>
      </div>

      {/* 7. Worker Status */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Worker</span>
          <span style={styles.cardStatusLabel}>Consumer</span>
        </div>
        <div style={styles.cardStatusContainer}>
          <span style={{ ...styles.statusDot, backgroundColor: workerRunning ? '#10b981' : '#f59e0b' }} />
          <span style={{ ...styles.statusText, color: workerRunning ? '#10b981' : '#f59e0b' }}>
            {workerRunning ? 'RUNNING' : 'STOPPED'}
          </span>
        </div>
        <div style={styles.cardSubtext}>Flow consumer worker</div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    width: '100%',
  },
  card: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#8b949e',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  iconBadge: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
  },
  cardStatusLabel: {
    fontSize: '10px',
    color: '#6e7681',
    backgroundColor: '#161b22',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  cardValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0f6fc',
    lineHeight: 1.2,
  },
  cardStatusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '4px 0',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  cardSubtext: {
    fontSize: '11px',
    color: '#6e7681',
  },
}

export default StatusCards
