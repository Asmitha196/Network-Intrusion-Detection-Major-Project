import React, { useState, useEffect, useCallback } from 'react'
import apiClient from '../api/client'
import type {
  Alert,
  HoneypotStatus,
  HoneypotEvent,
  AttackerProfile,
  CorrelatedIncident,
  ModelDriftStatus,
  WebSocketMessage,
} from '../types'

interface SecurityIntelligencePanelProps {
  alerts?: Alert[]
  lastMessage?: WebSocketMessage | null
}

export const SecurityIntelligencePanel: React.FC<SecurityIntelligencePanelProps> = ({
  alerts,
  lastMessage,
}) => {
  const [honeypotStatus, setHoneypotStatus] = useState<HoneypotStatus | null>(null)
  const [honeypotEvents, setHoneypotEvents] = useState<HoneypotEvent[]>([])
  const [riskyAttackers, setRiskyAttackers] = useState<AttackerProfile[]>([])
  const [correlatedIncidents, setCorrelatedIncidents] = useState<CorrelatedIncident[]>([])
  const [driftStatus, setDriftStatus] = useState<ModelDriftStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchSecurityIntelligence = useCallback(async () => {
    try {
      const [statusRes, hpEventsRes, attackersRes, incidentsRes, driftRes] = await Promise.all([
        apiClient.get<HoneypotStatus>('/honeypot/status'),
        apiClient.get<HoneypotEvent[]>('/honeypot/events?limit=5'),
        apiClient.get<AttackerProfile[]>('/attackers?limit=5'),
        apiClient.get<CorrelatedIncident[]>('/incidents?limit=5'),
        apiClient.get<ModelDriftStatus>('/evaluation/drift'),
      ])

      setHoneypotStatus(statusRes.data)
      setHoneypotEvents(hpEventsRes.data || [])
      setRiskyAttackers(attackersRes.data || [])
      setCorrelatedIncidents(incidentsRes.data || [])
      setDriftStatus(driftRes.data)
    } catch (e) {
      console.warn('Failed to fetch Security Intelligence data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSecurityIntelligence()
    const timer = setInterval(fetchSecurityIntelligence, 8000)
    return () => clearInterval(timer)
  }, [fetchSecurityIntelligence])

  // Trigger real-time update when a new WebSocket alert is pushed
  useEffect(() => {
    if (alerts && alerts.length > 0) {
      fetchSecurityIntelligence()
    }
  }, [alerts, fetchSecurityIntelligence])

  // Immediate reaction to typed WebSocket events (Honeypot, Incident, Risk Score)
  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== 'object' || !('type' in lastMessage)) return

    const msg = lastMessage as any
    if (msg.type === 'honeypot_event' && msg.event) {
      setHoneypotEvents((prev) => [msg.event, ...prev.filter((e) => e.id !== msg.event.id)].slice(0, 5))
      setHoneypotStatus((prev: any) =>
        prev
          ? {
              ...prev,
              total_events_database: prev.total_events_database + 1,
              total_interactions_session: prev.total_interactions_session + 1,
            }
          : prev
      )
    } else if (msg.type === 'correlated_incident' && msg.incident) {
      setCorrelatedIncidents((prev) => [
        msg.incident,
        ...prev.filter((i) => i.id !== msg.incident.id),
      ].slice(0, 5))
    } else if (msg.type === 'risk_score_update' && msg.source_ip) {
      setRiskyAttackers((prev) =>
        prev.map((a) =>
          a.source_ip === msg.source_ip
            ? { ...a, risk_score: msg.risk_score, risk_level: msg.risk_level }
            : a
        )
      )
    }
  }, [lastMessage])

  // Compute metric card totals
  const isHoneypotActive = honeypotStatus?.status === 'running'
  const hpInteractionsCount = honeypotStatus?.total_events_database ?? honeypotEvents.length
  const suspiciousSourcesCount = riskyAttackers.length
  const highRiskAttackersCount = riskyAttackers.filter((a) => a.risk_score >= 70).length
  const activeIncidentsCount = correlatedIncidents.filter(
    (i) => i.status === 'NEW' || i.status === 'INVESTIGATING'
  ).length

  const getRiskBadge = (level: string) => {
    const s = level.toUpperCase()
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

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr.toUpperCase()) {
      case 'NEW':
        return { bg: '#3d1419', text: '#ff7b72', border: '#7d1a24' }
      case 'INVESTIGATING':
        return { bg: '#362112', text: '#ffa657', border: '#844214' }
      default:
        return { bg: '#16231a', text: '#56d364', border: '#1b4b27' }
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>
          🛡️ REAL-TIME SECURITY INTELLIGENCE & DECOY TELEMETRY
        </h2>
        <span style={styles.liveIndicator}>
          <span style={styles.liveDot} /> WS Synchronized
        </span>
      </div>

      {/* 5 Security Intelligence Metric Cards */}
      <div style={styles.cardsGrid}>
        {/* 1. Honeypot Status */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>HONEYPOT STATUS</span>
            <span style={styles.cardIcon}>🍯</span>
          </div>
          <div style={styles.cardValue}>
            <span
              style={{
                ...styles.statusBadge,
                backgroundColor: isHoneypotActive ? '#16231a' : '#3d1419',
                color: isHoneypotActive ? '#56d364' : '#ff7b72',
                borderColor: isHoneypotActive ? '#1b4b27' : '#7d1a24',
              }}
            >
              {isHoneypotActive ? 'ACTIVE' : 'STOPPED'}
            </span>
          </div>
          <div style={styles.cardSub}>
            Port: <strong style={{ color: '#c9d1d9' }}>{honeypotStatus?.port || 8085}</strong> ({honeypotStatus?.service || 'http-decoy'})
          </div>
        </div>

        {/* 2. Honeypot Interactions */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>HONEYPOT INTERACTIONS</span>
            <span style={styles.cardIcon}>⚡</span>
          </div>
          <div style={styles.cardValue}>{hpInteractionsCount}</div>
          <div style={styles.cardSub}>
            Session: <strong style={{ color: '#58a6ff' }}>{honeypotStatus?.total_interactions_session ?? 0}</strong> probes
          </div>
        </div>

        {/* 3. Suspicious Sources */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>SUSPICIOUS SOURCES</span>
            <span style={styles.cardIcon}>🌐</span>
          </div>
          <div style={styles.cardValue}>{suspiciousSourcesCount}</div>
          <div style={styles.cardSub}>Distinct active intruder IPs</div>
        </div>

        {/* 4. High-Risk Attackers */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>HIGH-RISK ATTACKERS</span>
            <span style={styles.cardIcon}>🚨</span>
          </div>
          <div style={{ ...styles.cardValue, color: '#ff7b72' }}>{highRiskAttackersCount}</div>
          <div style={styles.cardSub}>Risk Score ≥ 70 / 100</div>
        </div>

        {/* 5. Correlated Incidents */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>CORRELATED INCIDENTS</span>
            <span style={styles.cardIcon}>🔗</span>
          </div>
          <div style={{ ...styles.cardValue, color: '#ffa657' }}>{activeIncidentsCount}</div>
          <div style={styles.cardSub}>Active multi-stage incidents</div>
        </div>

        {/* 6. Model Status & Drift */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>MODEL STATUS</span>
            <span style={styles.cardIcon}>🎯</span>
          </div>
          <div style={styles.cardValue}>
            <span
              style={{
                ...styles.statusBadge,
                backgroundColor: driftStatus?.status === 'WARNING' ? '#3d1419' : '#16231a',
                color: driftStatus?.status === 'WARNING' ? '#ff7b72' : '#56d364',
                borderColor: driftStatus?.status === 'WARNING' ? '#7d1a24' : '#1b4b27',
              }}
            >
              {driftStatus?.status || 'NORMAL'}
            </span>
          </div>
          <div style={styles.cardSub}>
            {driftStatus?.status === 'WARNING' ? 'Traffic distribution drift detected' : 'No distribution drift detected'}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingText}>Synchronizing Security Intelligence...</div>
      ) : (
        <div style={styles.threeColGrid}>
          {/* Sub-Section 1: RECENT HONEYPOT ACTIVITY */}
          <div style={styles.subPanel}>
            <h3 style={styles.subPanelTitle}>🍯 RECENT HONEYPOT ACTIVITY</h3>
            {honeypotEvents.length > 0 ? (
              <div style={styles.listContainer}>
                {honeypotEvents.map((ev) => {
                  const badge = getRiskBadge(ev.severity)
                  return (
                    <div key={ev.id} style={styles.listItem}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={styles.ipText}>{ev.src_ip}</span>
                          <span
                            style={{
                              ...styles.smallBadge,
                              backgroundColor: badge.bg,
                              color: badge.text,
                              borderColor: badge.border,
                            }}
                          >
                            {ev.severity.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '3px' }}>
                          <code style={{ color: '#ffa657' }}>{ev.request_type}</code>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#6e7681', fontFamily: 'monospace' }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={styles.emptyText}>No recent honeypot activity recorded.</div>
            )}
          </div>

          {/* Sub-Section 2: TOP RISKY ATTACKERS */}
          <div style={styles.subPanel}>
            <h3 style={styles.subPanelTitle}>🎯 TOP RISKY ATTACKERS</h3>
            {riskyAttackers.length > 0 ? (
              <div style={styles.listContainer}>
                {riskyAttackers.slice(0, 5).map((att) => {
                  const badge = getRiskBadge(att.risk_level)
                  return (
                    <div key={att.source_ip} style={styles.listItem}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={styles.ipText}>{att.source_ip}</span>
                          <span
                            style={{
                              ...styles.smallBadge,
                              backgroundColor: badge.bg,
                              color: badge.text,
                              borderColor: badge.border,
                            }}
                          >
                            RISK {att.risk_score}/100
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '3px' }}>
                          Alerts: <strong style={{ color: '#c9d1d9' }}>{att.total_alerts}</strong> | Decoy Hits: <strong style={{ color: '#d29922' }}>{att.honeypot_interactions}</strong>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={styles.emptyText}>No risky threat actors profiled yet.</div>
            )}
          </div>

          {/* Sub-Section 3: ACTIVE CORRELATED INCIDENTS */}
          <div style={styles.subPanel}>
            <h3 style={styles.subPanelTitle}>🔗 ACTIVE CORRELATED INCIDENTS</h3>
            {correlatedIncidents.length > 0 ? (
              <div style={styles.listContainer}>
                {correlatedIncidents.slice(0, 5).map((inc) => {
                  const badge = getStatusBadge(inc.status)
                  return (
                    <div key={inc.id} style={styles.listItem}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 700, fontSize: '12px', color: '#f0f6fc' }}>
                            {inc.title}
                          </span>
                          <span
                            style={{
                              ...styles.smallBadge,
                              backgroundColor: badge.bg,
                              color: badge.text,
                              borderColor: badge.border,
                            }}
                          >
                            {inc.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e' }}>
                          Source: <span style={styles.ipText}>{inc.source_ip}</span> | Risk Score: <strong style={{ color: '#ff7b72' }}>{inc.risk_score}/100</strong>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={styles.emptyText}>No active correlated incidents.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '20px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#f0f6fc',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  liveIndicator: {
    fontSize: '11px',
    color: '#56d364',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#16231a',
    border: '1px solid #1b4b27',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  liveDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#56d364',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  },
  card: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  cardTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#8b949e',
    letterSpacing: '0.5px',
  },
  cardIcon: {
    fontSize: '14px',
  },
  cardValue: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#f0f6fc',
    marginBottom: '4px',
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 800,
    border: '1px solid',
  },
  cardSub: {
    fontSize: '11px',
    color: '#8b949e',
  },
  threeColGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  subPanel: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '14px',
  },
  subPanelTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#f0f6fc',
    margin: '0 0 12px 0',
    letterSpacing: '0.3px',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  listItem: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '4px',
    padding: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ipText: {
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: '12px',
    color: '#58a6ff',
  },
  smallBadge: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: '8px',
    border: '1px solid',
  },
  emptyText: {
    fontSize: '12px',
    color: '#8b949e',
    textAlign: 'center',
    padding: '16px 0',
  },
  loadingText: {
    fontSize: '12px',
    color: '#8b949e',
    textAlign: 'center',
    padding: '20px 0',
  },
}
