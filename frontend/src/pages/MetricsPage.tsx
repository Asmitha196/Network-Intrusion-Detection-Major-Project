import React, { useState, useEffect } from 'react'
import AttackTimeline from '../components/AttackTimeline'
import AttackDistribution from '../components/AttackDistribution'
import apiClient from '../api/client'
import type { MetricsOverview, TimelineItem, TimelineResponse } from '../types'

export default function MetricsPage() {
  const [overview, setOverview] = useState<MetricsOverview | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [interval, setInterval] = useState<string>('5m')

  useEffect(() => {
    async function fetchData() {
      try {
        const [overviewRes, timelineRes] = await Promise.all([
          apiClient.get<MetricsOverview>('/metrics/overview'),
          apiClient.get<TimelineResponse>(`/metrics/timeline?interval=${interval}`),
        ])
        setOverview(overviewRes.data)
        setTimeline(timelineRes.data.timeline || [])
      } catch (e) {
        console.warn('Failed to fetch metrics:', e)
      }
    }
    fetchData()
  }, [interval])

  return (
    <div style={styles.container}>
      <div>
        <h2 style={styles.pageTitle}>Security Metrics & Analytics</h2>
        <span style={styles.pageSubtitle}>
          Deep-dive attack trends, TimescaleDB time-series aggregations, and severity breakdown
        </span>
      </div>

      {/* Overview Stat Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.card}>
          <span style={styles.label}>Today's Incidents</span>
          <div style={styles.val}>{overview?.today_alerts ?? 0}</div>
        </div>
        <div style={styles.card}>
          <span style={styles.label}>Critical Threats</span>
          <div style={{ ...styles.val, color: '#ef4444' }}>{overview?.critical_alerts ?? 0}</div>
        </div>
        <div style={styles.card}>
          <span style={styles.label}>High Threats</span>
          <div style={{ ...styles.val, color: '#f97316' }}>{overview?.high_alerts ?? 0}</div>
        </div>
        <div style={styles.card}>
          <span style={styles.label}>Medium Threats</span>
          <div style={{ ...styles.val, color: '#f59e0b' }}>{overview?.medium_alerts ?? 0}</div>
        </div>
      </div>

      {/* Main Charts */}
      <div style={styles.chartCol}>
        <AttackTimeline
          timeline={timeline}
          interval={interval}
          onIntervalChange={(newInterval) => setInterval(newInterval)}
        />
      </div>

      <div style={styles.twoCol}>
        <AttackDistribution overview={overview} />

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Benign vs Malicious Flow Ratio</h3>
          <div style={styles.ratioBox}>
            <div style={styles.ratioItem}>
              <span style={styles.ratioLabel}>Benign Flows</span>
              <span style={{ ...styles.ratioVal, color: '#10b981' }}>
                {overview?.benign_vs_malicious.benign ?? 0}
              </span>
            </div>

            <div style={styles.ratioItem}>
              <span style={styles.ratioLabel}>Malicious Threats</span>
              <span style={{ ...styles.ratioVal, color: '#ef4444' }}>
                {overview?.benign_vs_malicious.malicious ?? 0}
              </span>
            </div>
          </div>
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  card: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '16px 20px',
  },
  label: {
    fontSize: '11px',
    color: '#8b949e',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  val: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0f6fc',
    marginTop: '4px',
  },
  chartCol: {
    width: '100%',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#f0f6fc',
    marginBottom: '16px',
  },
  ratioBox: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '30px 10px',
  },
  ratioItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  ratioLabel: {
    fontSize: '12px',
    color: '#8b949e',
  },
  ratioVal: {
    fontSize: '32px',
    fontWeight: 800,
  },
}
