import { useState, useEffect, useCallback } from 'react'
import { useAlerts } from '../hooks/useAlerts'
import LiveMonitorPanel from '../components/LiveMonitorPanel'
import StatusCards from '../components/StatusCards'
import AttackTimeline from '../components/AttackTimeline'
import AttackDistribution from '../components/AttackDistribution'
import RecentAlertsTable from '../components/RecentAlertsTable'
import CriticalAlertsPanel from '../components/CriticalAlertsPanel'
import AlertDetailDrawer from '../components/AlertDetailDrawer'
import { SecurityIntelligencePanel } from '../components/SecurityIntelligencePanel'
import apiClient from '../api/client'

import type {
  Alert,
  SystemHealth,
  MetricsOverview,
  TimelineItem,
  TimelineResponse,
} from '../types'

export default function Dashboard() {
  const { alerts, lastMessage } = useAlerts()
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [overview, setOverview] = useState<MetricsOverview | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [interval, setInterval] = useState<string>('5m')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)

  // Fetch API metrics & health status independently so system health updates reliably
  const fetchDashboardData = useCallback(async () => {
    // 1. Fetch system health
    try {
      const healthRes = await apiClient.get<SystemHealth>('/health')
      setHealth(healthRes.data)
    } catch (e) {
      console.warn('Failed to fetch system health status:', e)
    }

    // 2. Fetch metrics & timeline
    try {
      const [overviewRes, timelineRes] = await Promise.all([
        apiClient.get<MetricsOverview>('/metrics/overview'),
        apiClient.get<TimelineResponse>(`/metrics/timeline?interval=${interval}`),
      ])
      setOverview(overviewRes.data)
      setTimeline(timelineRes.data.timeline || [])
    } catch (e) {
      console.warn('Failed to fetch dashboard metrics data:', e)
    }
  }, [interval])

  useEffect(() => {
    fetchDashboardData()
    const pollTimer = window.setInterval(() => {
      fetchDashboardData()
    }, 10000)
    return () => window.clearInterval(pollTimer)
  }, [fetchDashboardData])

  const handleAlertDeleted = (_deletedId: string) => {
    fetchDashboardData()
  }

  return (
    <div style={styles.container}>
      {/* Live Monitoring Engine Control & Real-time Metrics Panel */}
      <section style={styles.section}>
        <LiveMonitorPanel onAlertSelect={(alert) => setSelectedAlert(alert)} />
      </section>

      {/* 1. System Health Status Cards */}
      <section style={styles.section}>
        <StatusCards health={health} overview={overview} />
      </section>

      {/* 1.5 Security Intelligence & Decoy Telemetry Panel */}
      <section style={styles.section}>
        <SecurityIntelligencePanel alerts={alerts} lastMessage={lastMessage} />
      </section>

      {/* 2. Attack Timeline & 3. Attack Distribution */}
      <section style={styles.twoCol}>
        <div style={styles.timelineCol}>
          <AttackTimeline
            timeline={timeline}
            interval={interval}
            onIntervalChange={(newInterval) => setInterval(newInterval)}
          />
        </div>
        <div style={styles.distributionCol}>
          <AttackDistribution overview={overview} />
        </div>
      </section>

      {/* 4. Latest Critical Alerts & 5. Recent Alerts Table */}
      <section style={styles.twoColAlt}>
        <div style={styles.recentCol}>
          <RecentAlertsTable
            alerts={alerts}
            onSelectAlert={(alert) => setSelectedAlert(alert)}
          />
        </div>

        <div style={styles.criticalCol}>
          <CriticalAlertsPanel
            alerts={alerts}
            onSelectAlert={(alert) => setSelectedAlert(alert)}
          />
        </div>
      </section>

      {/* 6. Alert Detail Drawer */}
      {selectedAlert && (
        <AlertDetailDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAlertDeleted={handleAlertDeleted}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    backgroundColor: '#090d16',
    minHeight: 'calc(100vh - 60px)',
    color: '#f0f6fc',
  },
  section: {
    width: '100%',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '24px',
    alignItems: 'stretch',
  },
  twoColAlt: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '24px',
    alignItems: 'stretch',
  },
  timelineCol: {
    minWidth: 0,
  },
  distributionCol: {
    minWidth: 0,
  },
  recentCol: {
    minWidth: 0,
  },
  criticalCol: {
    minWidth: 0,
  },
}
