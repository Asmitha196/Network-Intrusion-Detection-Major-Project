import React, { useState, useEffect } from 'react'
import apiClient from '../api/client'
import type {
  HoneypotStatus,
  HoneypotStats,
  HoneypotEvent,
  HoneypotCorrelatedAlert,
  AttackerProfile,
} from '../types'
import { AttackerBehaviorTimeline } from '../components/AttackerBehaviorTimeline'

export default function HoneypotPage() {
  const [status, setStatus] = useState<HoneypotStatus | null>(null)
  const [stats, setStats] = useState<HoneypotStats | null>(null)
  const [events, setEvents] = useState<HoneypotEvent[]>([])
  const [correlatedAlerts, setCorrelatedAlerts] = useState<HoneypotCorrelatedAlert[]>([])
  const [attackerProfiles, setAttackerProfiles] = useState<AttackerProfile[]>([])
  const [selectedIp, setSelectedIp] = useState<string>('')
  
  // Filtering & loading states
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL')
  const [controlLoading, setControlLoading] = useState<boolean>(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [statusRes, statsRes, eventsRes, correlatedRes, profilesRes] = await Promise.all([
        apiClient.get<HoneypotStatus>('/honeypot/status'),
        apiClient.get<HoneypotStats>('/honeypot/stats'),
        apiClient.get<HoneypotEvent[]>('/honeypot/events?limit=100'),
        apiClient.get<HoneypotCorrelatedAlert[]>('/honeypot/correlated-alerts?limit=20'),
        apiClient.get<AttackerProfile[]>('/attackers?limit=50'),
      ])

      setStatus(statusRes.data)
      setStats(statsRes.data)
      setEvents(eventsRes.data || [])
      setCorrelatedAlerts(correlatedRes.data || [])
      setAttackerProfiles(profilesRes.data || [])

      // Auto-select top honeypot attacker IP for timeline if available
      if (statsRes.data?.top_attackers && statsRes.data.top_attackers.length > 0) {
        setSelectedIp(statsRes.data.top_attackers[0].ip)
      } else if (eventsRes.data && eventsRes.data.length > 0) {
        setSelectedIp(eventsRes.data[0].src_ip)
      }
    } catch (err: any) {
      console.error('Failed to load honeypot telemetry:', err)
      setError('Failed to fetch Honeypot telemetry. Please verify backend service is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleToggleDecoyServer = async (action: 'start' | 'stop') => {
    setControlLoading(true)
    setActionMsg(null)
    try {
      await apiClient.post<{ status: string; host?: string; port?: number }>(
        `/honeypot/${action}`
      )
      setActionMsg(`Decoy server ${action === 'start' ? 'started' : 'stopped'} successfully!`)
      fetchData()
    } catch (err: any) {
      console.error(`Failed to ${action} decoy server:`, err)
      setError(`Failed to ${action} decoy server.`)
    } finally {
      setControlLoading(false)
    }
  }

  // Calculate metrics
  const totalInteractions = status?.total_events_database ?? events.length
  const uniqueSourcesCount = stats?.top_attackers ? stats.top_attackers.length : new Set(events.map((e) => e.src_ip)).size
  
  // Match risk scores for top attackers
  const highRiskSourcesCount = attackerProfiles.filter(
    (p) => p.honeypot_interactions > 0 && p.risk_score >= 70
  ).length

  const getSeverityBadge = (sev: string) => {
    const s = sev.toUpperCase()
    switch (s) {
      case 'CRITICAL':
        return { bg: '#3d1419', text: '#ff7b72', border: '#7d1a24' }
      case 'HIGH':
        return { bg: '#362112', text: '#ffa657', border: '#844214' }
      case 'MEDIUM':
        return { bg: '#2b2c14', text: '#d29922', border: '#695010' }
      default:
        return { bg: '#16231a', text: '#56d364', border: '#1b4b27' }
    }
  }

  const filteredEvents = events.filter((ev) => {
    const matchSearch =
      !searchTerm ||
      ev.src_ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.request_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.service.toLowerCase().includes(searchTerm.toLowerCase())
    const matchType = selectedEventType === 'ALL' || ev.event_type === selectedEventType
    const matchSev = selectedSeverity === 'ALL' || ev.severity.toUpperCase() === selectedSeverity.toUpperCase()
    return matchSearch && matchType && matchSev
  })

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Honeypot Decoy Operations Center</h1>
          <p style={styles.subtitle}>
            Isolated decoy server telemetry, intruder engagement metrics, targeted decoy services, and threat timelines
          </p>
        </div>

        {/* Server Control Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {status?.status === 'running' ? (
            <button
              onClick={() => handleToggleDecoyServer('stop')}
              disabled={controlLoading}
              style={{ ...styles.controlBtn, backgroundColor: '#da3633' }}
            >
              Stop Decoy Server
            </button>
          ) : (
            <button
              onClick={() => handleToggleDecoyServer('start')}
              disabled={controlLoading}
              style={{ ...styles.controlBtn, backgroundColor: '#238636' }}
            >
              Start Decoy Server
            </button>
          )}
          <button onClick={fetchData} style={styles.refreshBtn}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {actionMsg && <div style={styles.successBox}>{actionMsg}</div>}
      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Metric Cards Grid */}
      <div style={styles.cardsGrid}>
        {/* Card 1: HONEYPOT STATUS */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>HONEYPOT STATUS</span>
            <span style={styles.cardIcon}>🍯</span>
          </div>
          <div style={styles.cardMainValue}>
            <span
              style={{
                ...styles.statusBadge,
                backgroundColor: status?.status === 'running' ? '#16231a' : '#3d1419',
                color: status?.status === 'running' ? '#56d364' : '#ff7b72',
                borderColor: status?.status === 'running' ? '#1b4b27' : '#7d1a24',
              }}
            >
              {status?.status === 'running' ? 'ACTIVE' : 'STOPPED'}
            </span>
          </div>
          <div style={styles.cardSubtext}>
            Host: <strong style={{ color: '#c9d1d9' }}>{status?.host || '127.0.0.1'}</strong> : <strong style={{ color: '#c9d1d9' }}>{status?.port || 8085}</strong> ({status?.service || 'http-decoy'})
          </div>
        </div>

        {/* Card 2: INTERACTIONS */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>INTERACTIONS</span>
            <span style={styles.cardIcon}>⚡</span>
          </div>
          <div style={styles.cardMainValue}>{totalInteractions}</div>
          <div style={styles.cardSubtext}>
            Session: <strong style={{ color: '#58a6ff' }}>{status?.total_interactions_session ?? 0}</strong> probes logged
          </div>
        </div>

        {/* Card 3: UNIQUE SOURCES */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>UNIQUE SOURCES</span>
            <span style={styles.cardIcon}>🌐</span>
          </div>
          <div style={styles.cardMainValue}>{uniqueSourcesCount}</div>
          <div style={styles.cardSubtext}>Distinct external intruder IPs</div>
        </div>

        {/* Card 4: HIGH-RISK SOURCES */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>HIGH-RISK SOURCES</span>
            <span style={styles.cardIcon}>🚨</span>
          </div>
          <div style={{ ...styles.cardMainValue, color: '#ff7b72' }}>{highRiskSourcesCount}</div>
          <div style={styles.cardSubtext}>Sources with Risk Score ≥ 70</div>
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading Honeypot Telemetry...</div>
      ) : (
        <>
          {/* Targeted Services, Event Types & Severity Breakdown */}
          <div style={styles.twoColLayout}>
            {/* Targeted Services & Event Types */}
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>🎯 TARGETED SERVICES & EVENT CLASSIFICATION</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={styles.sectionSubHeader}>Decoy Services List</div>
                <div style={styles.tagsContainer}>
                  <div style={styles.serviceTag}>
                    <span>HTTP Decoy (Port {status?.port || 8085})</span>
                    <strong style={{ color: '#58a6ff' }}>{totalInteractions} hits</strong>
                  </div>
                  <div style={styles.serviceTag}>
                    <span>SSH Honeypot Decoy (Port 2222)</span>
                    <strong style={{ color: '#8b949e' }}>Standby</strong>
                  </div>
                </div>
              </div>

              <div>
                <div style={styles.sectionSubHeader}>Event Type Breakdown</div>
                <div style={styles.breakdownGrid}>
                  {Object.entries(stats?.by_event_type || { SUSPICIOUS_REQUEST: totalInteractions }).map(
                    ([type, count]) => (
                      <div key={type} style={styles.breakdownCard}>
                        <span style={styles.breakdownLabel}>{type}</span>
                        <span style={styles.breakdownValue}>{count}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Severity Breakdown */}
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>🛡️ INCIDENT SEVERITY BREAKDOWN</h3>
              <div style={styles.severityGrid}>
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => {
                  const cnt = stats?.by_severity?.[sev] || stats?.by_severity?.[sev.toLowerCase()] || 0
                  const styleBadge = getSeverityBadge(sev)
                  return (
                    <div
                      key={sev}
                      style={{
                        ...styles.severityBox,
                        backgroundColor: styleBadge.bg,
                        borderColor: styleBadge.border,
                      }}
                    >
                      <span style={{ color: styleBadge.text, fontWeight: 700, fontSize: '13px' }}>
                        {sev} SEVERITY
                      </span>
                      <span style={{ color: styleBadge.text, fontWeight: 800, fontSize: '24px' }}>
                        {cnt}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Top Suspicious Sources & Risk Scores Table */}
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>🔥 TOP SUSPICIOUS SOURCES & RISK SCORES</h3>
            {stats?.top_attackers && stats.top_attackers.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Source IP</th>
                      <th style={styles.th}>Decoy Interactions</th>
                      <th style={styles.th}>Risk Score</th>
                      <th style={styles.th}>Risk Level</th>
                      <th style={styles.th}>Attack Vectors</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top_attackers.map((att) => {
                      const profile = attackerProfiles.find((p) => p.source_ip === att.ip)
                      const rScore = profile?.risk_score ?? 75
                      const rLevel = profile?.risk_level ?? (rScore >= 80 ? 'CRITICAL' : 'HIGH')
                      const badge = getSeverityBadge(rLevel)
                      const isSelected = selectedIp === att.ip

                      return (
                        <tr
                          key={att.ip}
                          style={{
                            ...styles.tr,
                            backgroundColor: isSelected ? '#1f2937' : 'transparent',
                          }}
                        >
                          <td style={styles.td}>
                            <span style={styles.ipText}>{att.ip}</span>
                          </td>
                          <td style={styles.td}>
                            <strong style={{ color: '#d29922' }}>{att.count} probes</strong>
                          </td>
                          <td style={styles.td}>
                            <strong style={{ color: badge.text }}>{rScore}/100</strong>
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.badge,
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                            >
                              {rLevel}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', color: '#8b949e' }}>
                              {profile?.attack_types?.join(', ') || 'Decoy Probe & Scan'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <button
                              onClick={() => setSelectedIp(att.ip)}
                              style={{
                                ...styles.inspectBtn,
                                backgroundColor: isSelected ? '#238636' : '#21262d',
                              }}
                            >
                              {isSelected ? 'Viewing Timeline' : 'Inspect Timeline'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={styles.emptyState}>No suspicious sources recorded yet.</div>
            )}
          </div>

          {/* Attacker Behavior Timeline Section */}
          {selectedIp && (
            <div style={{ marginBottom: '24px' }}>
              <AttackerBehaviorTimeline sourceIp={selectedIp} />
            </div>
          )}

          {/* Recent Honeypot Events Log Table */}
          <div style={styles.panel}>
            <div style={styles.panelHeaderRow}>
              <h3 style={styles.panelTitle}>📜 RECENT HONEYPOT DECOY EVENTS LOG</h3>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Filter by IP / URI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.filterInput}
                />
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="ALL">All Event Types</option>
                  <option value="SUSPICIOUS_REQUEST">SUSPICIOUS_REQUEST</option>
                  <option value="HTTP_PROBE">HTTP_PROBE</option>
                  <option value="CONNECTION_ATTEMPT">CONNECTION_ATTEMPT</option>
                </select>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>

            {filteredEvents.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Timestamp</th>
                      <th style={styles.th}>Source IP:Port</th>
                      <th style={styles.th}>Decoy Target</th>
                      <th style={styles.th}>Event Type</th>
                      <th style={styles.th}>Severity</th>
                      <th style={styles.th}>Request Payload / Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((ev) => {
                      const badge = getSeverityBadge(ev.severity)
                      return (
                        <tr key={ev.id} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', color: '#8b949e', fontFamily: 'monospace' }}>
                              {new Date(ev.timestamp).toLocaleString()}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.ipText}>
                              {ev.src_ip}:{ev.src_port}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', color: '#c9d1d9' }}>
                              {ev.service} ({ev.dst_ip}:{ev.dst_port})
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#58a6ff' }}>
                              {ev.event_type}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.badge,
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                            >
                              {ev.severity.toUpperCase()}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <code style={styles.codePayload}>{ev.request_type}</code>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={styles.emptyState}>No matching honeypot events found.</div>
            )}
          </div>

          {/* Correlated NIDS Alerts Section */}
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>🔗 CORRELATED NIDS SECURITY ALERTS WITH HONEYPOT EVIDENCE</h3>
            {correlatedAlerts.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Timestamp</th>
                      <th style={styles.th}>Source IP</th>
                      <th style={styles.th}>Attack Type</th>
                      <th style={styles.th}>Stage</th>
                      <th style={styles.th}>Severity</th>
                      <th style={styles.th}>Evidence Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correlatedAlerts.map((alt) => {
                      const badge = getSeverityBadge(alt.severity)
                      return (
                        <tr key={alt.id} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', color: '#8b949e', fontFamily: 'monospace' }}>
                              {new Date(alt.timestamp).toLocaleString()}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.ipText}>{alt.src_ip}</span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontWeight: 600, color: '#f0f6fc' }}>{alt.attack_type}</span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', color: '#8b949e' }}>Stage {alt.stage}</span>
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.badge,
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                            >
                              {alt.severity.toUpperCase()}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '11px', color: '#d29922' }}>
                              {alt.tags?.join(', ') || 'honeypot_activity'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={styles.emptyState}>No correlated NIDS alerts with honeypot activity recorded.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    backgroundColor: '#090d16',
    color: '#f0f6fc',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 800,
    margin: 0,
    color: '#f0f6fc',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#8b949e',
    margin: '4px 0 0 0',
  },
  controlBtn: {
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  refreshBtn: {
    backgroundColor: '#21262d',
    color: '#c9d1d9',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  successBox: {
    backgroundColor: '#16231a',
    border: '1px solid #1b4b27',
    color: '#56d364',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '13px',
  },
  errorBox: {
    backgroundColor: '#3d1419',
    border: '1px solid #7d1a24',
    color: '#ff7b72',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '13px',
  },
  loadingBox: {
    padding: '40px',
    textAlign: 'center',
    color: '#8b949e',
    fontSize: '14px',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  card: {
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  cardTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#8b949e',
    letterSpacing: '0.5px',
  },
  cardIcon: {
    fontSize: '16px',
  },
  cardMainValue: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#f0f6fc',
    marginBottom: '8px',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 800,
    border: '1px solid',
    letterSpacing: '0.5px',
  },
  cardSubtext: {
    fontSize: '12px',
    color: '#8b949e',
  },
  twoColLayout: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px',
    marginBottom: '24px',
  },
  panel: {
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
  },
  panelHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  panelTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#f0f6fc',
    margin: '0 0 16px 0',
  },
  sectionSubHeader: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#8b949e',
    marginBottom: '8px',
    textTransform: 'uppercase',
  },
  tagsContainer: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  serviceTag: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '13px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flex: 1,
    minWidth: '200px',
  },
  breakdownGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px',
  },
  breakdownCard: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  breakdownLabel: {
    fontSize: '11px',
    color: '#8b949e',
    fontWeight: 600,
  },
  breakdownValue: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#58a6ff',
  },
  severityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  severityBox: {
    border: '1px solid',
    borderRadius: '6px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '1px solid #30363d',
    color: '#8b949e',
    fontSize: '12px',
    fontWeight: 600,
  },
  tr: {
    borderBottom: '1px solid #21262d',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '12px',
    verticalAlign: 'middle',
  },
  ipText: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#58a6ff',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '10px',
    border: '1px solid',
  },
  inspectBtn: {
    color: '#f0f6fc',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '24px',
    color: '#8b949e',
    fontSize: '13px',
  },
  filterInput: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#f0f6fc',
    padding: '6px 12px',
    fontSize: '12px',
  },
  filterSelect: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#f0f6fc',
    padding: '6px 12px',
    fontSize: '12px',
  },
  codePayload: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    color: '#ffa657',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
}
