import React from 'react'
import type { TrafficStats } from '../types'

interface Props {
  stats: TrafficStats | null
}

/**
 * TrafficFeed — live network traffic statistics bar.
 *
 * Displays:
 *   • Packets/second
 *   • Bytes/second (formatted as KB/s or MB/s)
 *   • Active flows
 *   • Top 5 source IPs by packet count
 */
export default function TrafficFeed({ stats }: Props) {
  const formatBytes = (bps: number): string => {
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} KB/s`
    return `${bps.toFixed(0)} B/s`
  }

  const packetsPerSec = stats?.packets_per_sec ?? 0
  const bytesPerSec = stats?.bytes_per_sec ?? 0
  const activeFlows = stats?.active_flows ?? stats?.total_flows_processed ?? 0
  const topSrcIps = stats?.top_src_ips ?? []

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Live Traffic</h2>
      {stats === null ? (
        <p style={styles.muted}>Connecting to traffic stream...</p>
      ) : (
        <div style={styles.grid}>
          <Stat label="Packets/s" value={packetsPerSec.toFixed(0)} />
          <Stat label="Throughput" value={formatBytes(bytesPerSec)} />
          <Stat label="Active Flows" value={String(activeFlows)} />
          <div style={styles.ipBlock}>
            <p style={styles.ipLabel}>Top Source IPs</p>
            {topSrcIps.length === 0 ? (
              <p style={styles.muted}>—</p>
            ) : (
              topSrcIps.slice(0, 5).map(({ ip, count }) => (
                <div key={ip} style={styles.ipRow}>
                  <span style={styles.ipAddr}>{ip}</span>
                  <span style={styles.ipCount}>{count} pkts</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
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
  muted: { color: '#64748b', fontSize: 13 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 2fr', gap: 16 },
  stat: { display: 'flex', flexDirection: 'column', gap: 2 },
  statValue: { fontSize: 24, fontWeight: 700, color: '#e2e8f0' },
  statLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  ipBlock: { display: 'flex', flexDirection: 'column', gap: 4 },
  ipLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 },
  ipRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' },
  ipAddr: { fontFamily: 'monospace' },
  ipCount: { color: '#64748b' },
}
