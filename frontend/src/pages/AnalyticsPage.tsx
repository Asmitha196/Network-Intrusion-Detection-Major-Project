import React, { useState, useEffect } from 'react'
import apiClient from '../api/client'
import type { AnalyticsOverview } from '../types'

export default function AnalyticsPage() {
  const [window, setWindow] = useState<string>('24h')
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await apiClient.get<AnalyticsOverview>(`/analytics/overview?window=${window}`)
        setAnalytics(res.data)
      } catch (e) {
        console.warn('Failed to fetch analytics:', e)
      }
    }
    fetchAnalytics()
  }, [window])

  const topAttacks = analytics?.top_attacks || []
  const topSources = analytics?.top_sources || []
  const topPorts = analytics?.top_ports || []

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Advanced Threat Analytics & Telemetry</h2>
          <span style={styles.pageSubtitle}>
            Historical attack trends, protocol breakdowns, top target ports, and threat source heatmaps
          </span>
        </div>

        <div style={styles.windowGroup}>
          <button style={{ ...styles.wBtn, backgroundColor: window === '1h' ? '#2563eb' : '#21262d' }} onClick={() => setWindow('1h')}>1 Hour</button>
          <button style={{ ...styles.wBtn, backgroundColor: window === '24h' ? '#2563eb' : '#21262d' }} onClick={() => setWindow('24h')}>24 Hours</button>
          <button style={{ ...styles.wBtn, backgroundColor: window === '7d' ? '#2563eb' : '#21262d' }} onClick={() => setWindow('7d')}>7 Days</button>
          <button style={{ ...styles.wBtn, backgroundColor: window === '30d' ? '#2563eb' : '#21262d' }} onClick={() => setWindow('30d')}>30 Days</button>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Top Attack Vectors */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top Detected Attack Vectors</h3>
          <div style={styles.list}>
            {topAttacks.map((atk) => (
              <div key={atk.attack_type} style={styles.item}>
                <span style={styles.itemTitle}>{atk.attack_type}</span>
                <span style={styles.itemVal}>{atk.count} detections</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Targeted Destination Ports */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top Targeted Destination Ports</h3>
          <div style={styles.list}>
            {topPorts.map((p) => (
              <div key={p.port} style={styles.item}>
                <span style={styles.itemTitle}>Port {p.port}</span>
                <span style={styles.itemVal}>{p.count} flows</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Threat Source Hosts */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top Threat Source Hosts</h3>
          <div style={styles.list}>
            {topSources.map((src) => (
              <div key={src.ip} style={styles.item}>
                <div>
                  <span style={styles.itemTitle}>{src.ip}</span>
                  <span style={styles.itemSub}>{src.country}</span>
                </div>
                <span style={{ ...styles.itemVal, color: '#ef4444' }}>{src.count} events</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: '20px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  pageSubtitle: { fontSize: '12px', color: '#8b949e' },
  windowGroup: { display: 'flex', gap: '6px' },
  wBtn: { color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' },
  card: { backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  cardTitle: { fontSize: '15px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22', padding: '10px 12px', borderRadius: '6px' },
  itemTitle: { fontSize: '13px', fontWeight: 700, color: '#f0f6fc', fontFamily: 'monospace' },
  itemSub: { display: 'block', fontSize: '10px', color: '#8b949e' },
  itemVal: { fontSize: '12px', fontWeight: 700, color: '#38bdf8' },
}
