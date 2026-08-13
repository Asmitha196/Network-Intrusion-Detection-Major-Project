import React, { useState, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import apiClient from '../api/client'
import type { MetricsOverview, TrafficStats, WebSocketMessage } from '../types'

interface ActiveHostItem {
  ip: string
  type: string
  status: string
}

export default function TrafficPage() {
  const { lastMessage } = useWebSocket<WebSocketMessage>('/ws/traffic')
  const [overview, setOverview] = useState<MetricsOverview | null>(null)
  const [hosts, setHosts] = useState<ActiveHostItem[]>([])

  const trafficStats =
    lastMessage && typeof lastMessage === 'object' && 'type' in lastMessage && lastMessage.type === 'traffic_stats'
      ? (lastMessage as TrafficStats)
      : null

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const [overviewRes, analyticsRes] = await Promise.allSettled([
          apiClient.get<MetricsOverview>('/metrics/overview'),
          apiClient.get<any>('/analytics'),
        ])

        if (overviewRes.status === 'fulfilled') {
          setOverview(overviewRes.value.data)
        }

        if (analyticsRes.status === 'fulfilled') {
          const data = analyticsRes.value.data
          const hostList: ActiveHostItem[] = []

          if (Array.isArray(data?.top_sources)) {
            data.top_sources.forEach((s: any) => {
              if (s.ip && !hostList.some(h => h.ip === s.ip)) {
                hostList.push({
                  ip: s.ip,
                  type: s.country || (s.ip.startsWith('192.168.') || s.ip.startsWith('10.') || s.ip.startsWith('172.16.') ? 'Internal Host' : 'Threat Source'),
                  status: 'Active',
                })
              }
            })
          }

          if (Array.isArray(data?.top_destinations)) {
            data.top_destinations.forEach((d: any) => {
              if (d.ip && !hostList.some(h => h.ip === d.ip)) {
                hostList.push({
                  ip: d.ip,
                  type: d.label || 'Target Gateway',
                  status: 'Active',
                })
              }
            })
          }

          setHosts(hostList)
        }
      } catch (e) {
        console.warn('Failed to fetch live traffic metrics:', e)
      }
    }

    fetchMetrics()
    const timer = setInterval(fetchMetrics, 5000)
    return () => clearInterval(timer)
  }, [])

  const protocols = overview?.protocols || [
    { protocol: 'TCP', count: 0 },
    { protocol: 'UDP', count: 0 },
  ]

  const totalProcessed = trafficStats?.total_flows_processed ?? overview?.total_alerts ?? 0
  const activeAlerts = trafficStats?.total_alerts_generated ?? overview?.today_alerts ?? 0

  return (
    <div style={styles.container}>
      <div>
        <h2 style={styles.pageTitle}>Live Traffic & Protocol Telemetry</h2>
        <span style={styles.pageSubtitle}>
          Real-time packet and flow activity streaming over WebSocket
        </span>
      </div>

      {/* Traffic Summary Cards */}
      <div style={styles.grid}>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Processed Flow Records</span>
          <div style={styles.cardValue}>{totalProcessed}</div>
          <span style={styles.cardSub}>Total database flow entries</span>
        </div>

        <div style={styles.card}>
          <span style={styles.cardLabel}>Generated Threat Alerts</span>
          <div style={{ ...styles.cardValue, color: '#ef4444' }}>{activeAlerts}</div>
          <span style={styles.cardSub}>Stage 1 & Stage 2 detections</span>
        </div>

        <div style={styles.card}>
          <span style={styles.cardLabel}>Traffic Stream Status</span>
          <div style={{ ...styles.cardValue, color: '#10b981' }}>ACTIVE</div>
          <span style={styles.cardSub}>WebSocket /ws/traffic</span>
        </div>
      </div>

      {/* Protocol Breakdown & IP Tables */}
      <div style={styles.twoCol}>
        {/* Protocol Distribution */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Protocol Distribution</h3>
          <div style={styles.protoList}>
            {protocols.map((proto) => (
              <div key={proto.protocol} style={styles.protoItem}>
                <div style={styles.protoHeader}>
                  <span style={styles.protoName}>{proto.protocol}</span>
                  <span style={styles.protoCount}>{proto.count} flows</span>
                </div>
                <div style={styles.barBg}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${Math.min(100, Math.max(10, proto.count * 10))}%`,
                      backgroundColor: proto.protocol === 'TCP' ? '#3b82f6' : '#a855f7',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Active Network Hosts */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Active Network Hosts</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Host IP</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {hosts.length > 0 ? (
                hosts.map((host) => (
                  <tr key={host.ip}>
                    <td style={styles.tdIp}>{host.ip}</td>
                    <td style={styles.td}>{host.type}</td>
                    <td style={styles.tdActive}>{host.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: '#6e7681', padding: '20px' }}>
                    No active network hosts recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  pageTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f0f6fc',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '12px',
    color: '#8b949e',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '16px 20px',
  },
  cardLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8b949e',
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: '26px',
    fontWeight: 700,
    color: '#f0f6fc',
    margin: '6px 0',
  },
  cardSub: {
    fontSize: '11px',
    color: '#6e7681',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#f0f6fc',
    marginBottom: '16px',
  },
  protoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  protoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  protoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
  },
  protoName: {
    fontWeight: 700,
    color: '#f0f6fc',
  },
  protoCount: {
    color: '#8b949e',
  },
  barBg: {
    height: '8px',
    backgroundColor: '#161b22',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '4px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  th: {
    textAlign: 'left',
    padding: '8px',
    borderBottom: '1px solid #30363d',
    color: '#8b949e',
    fontSize: '11px',
    textTransform: 'uppercase',
  },
  td: {
    padding: '10px 8px',
    color: '#c9d1d9',
  },
  tdIp: {
    padding: '10px 8px',
    fontFamily: 'monospace',
    color: '#58a6ff',
  },
  tdActive: {
    padding: '10px 8px',
    color: '#10b981',
    fontWeight: 600,
  },
}
