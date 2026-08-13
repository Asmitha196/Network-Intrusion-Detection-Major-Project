import { useState, useEffect, useCallback } from 'react'
import { Play, Square, RefreshCw, Bug, ShieldAlert } from 'lucide-react'
import apiClient from '../api/client'
import { StatCard, SectionHeader, Panel, SeverityBadge, IP, Table, Tr, Td, EmptyState, LoadingState, Severity } from '../components/ui'
import { useWebSocket } from '../hooks/useWebSocket'
import type { HoneypotStatus, HoneypotStats, HoneypotEvent, HoneypotCorrelatedAlert, WebSocketMessage } from '../types'

const SEVERITY_MAP: Record<string, Severity> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
}

export default function HoneypotPage() {
  const [status, setStatus] = useState<HoneypotStatus | null>(null)
  const [stats, setStats] = useState<HoneypotStats | null>(null)
  const [events, setEvents] = useState<HoneypotEvent[]>([])
  const [correlatedAlerts, setCorrelatedAlerts] = useState<HoneypotCorrelatedAlert[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action: 'start' | 'stop' }>({ open: false, action: 'start' })
  const [selectedIp, setSelectedIp] = useState<string | null>(null)
  const [ipCorrelation, setIpCorrelation] = useState<any | null>(null)
  const [ipLoading, setIpLoading] = useState<boolean>(false)

  // WebSockets stream `/ws/alerts` for real-time correlated alerts
  const { lastMessage: wsMsg } = useWebSocket<WebSocketMessage>('/ws/alerts')

  // Fetch real honeypot telemetry from backend
  const fetchHoneypotData = useCallback(async () => {
    try {
      setLoading(true)
      const [statusRes, statsRes, eventsRes, correlatedRes] = await Promise.allSettled([
        apiClient.get<HoneypotStatus>('/honeypot/status'),
        apiClient.get<HoneypotStats>('/honeypot/stats'),
        apiClient.get<HoneypotEvent[]>('/honeypot/events?limit=50'),
        apiClient.get<HoneypotCorrelatedAlert[]>('/honeypot/correlated-alerts'),
      ])

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data)
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
      if (eventsRes.status === 'fulfilled') setEvents(Array.isArray(eventsRes.value.data) ? eventsRes.value.data : [])
      if (correlatedRes.status === 'fulfilled') setCorrelatedAlerts(Array.isArray(correlatedRes.value.data) ? correlatedRes.value.data : [])
    } catch (err) {
      console.error('Failed to load honeypot telemetry:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHoneypotData()
  }, [fetchHoneypotData])

  // Fetch IP correlation when an IP is selected
  useEffect(() => {
    if (!selectedIp) {
      setIpCorrelation(null)
      return
    }

    let isMounted = true
    setIpLoading(true)

    apiClient.get<any>(`/honeypot/ip-correlation/${encodeURIComponent(selectedIp)}`)
      .then(res => {
        if (isMounted) setIpCorrelation(res.data)
      })
      .catch(err => {
        console.error(`Failed to fetch IP correlation for ${selectedIp}:`, err)
        if (isMounted) setIpCorrelation(null)
      })
      .finally(() => {
        if (isMounted) setIpLoading(false)
      })

    return () => { isMounted = false }
  }, [selectedIp])

  // Process incoming real-time WebSocket messages
  useEffect(() => {
    if (!wsMsg) return
    if ('honeypot' in wsMsg || ('service' in wsMsg && 'src_ip' in wsMsg)) {
      fetchHoneypotData()
    }
  }, [wsMsg, fetchHoneypotData])

  // Control Handlers: POST /honeypot/start and POST /honeypot/stop
  const executeHoneypotToggle = async (action: 'start' | 'stop') => {
    try {
      setActionLoading(true)
      setConfirmModal({ open: false, action })
      if (action === 'stop') {
        await apiClient.post('/honeypot/stop')
      } else {
        await apiClient.post('/honeypot/start')
      }
      await fetchHoneypotData()
    } catch (err: any) {
      console.error('Failed to toggle honeypot state:', err)
      alert(`Honeypot action failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const isRunning = Boolean(status?.status === 'running' || status?.running || status?.status === 'active' || status?.status === 'listening')
  const totalInteractions = status?.total_events_database ?? status?.total_interactions_session ?? events.length
  const uniqueSources = stats?.top_attackers?.length ?? new Set(events.map(e => e.src_ip)).size
  const correlatedAlertsCount = correlatedAlerts.length

  const serviceColors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#00f2fe', '#10b981']

  const activeListenersText = status?.host && status?.port
    ? `${status.service || 'http-decoy'} (${status.host}:${status.port})`
    : 'HTTP Decoy (127.0.0.1:8080)'

  return (
    <div className="space-y-4 select-none">

      {/* ── STAT CARDS & CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: isRunning ? 'var(--low-dim)' : 'var(--crit-dim)' }}>
            <Bug size={20} style={{ color: isRunning ? 'var(--low)' : 'var(--crit)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-mono font-bold" style={{ color: 'var(--tx-1)' }}>Honeypot Decoy System</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                style={isRunning
                  ? { background: 'var(--low-dim)', border: '1px solid var(--low-border)', color: 'var(--low)' }
                  : { background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }
                }>
                {isRunning ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>
            <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--tx-4)' }}>
              Active Service: {activeListenersText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHoneypotData}
            disabled={loading}
            className="p-2 rounded-lg transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
            title="Refresh Telemetry"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setConfirmModal({ open: true, action: isRunning ? 'stop' : 'start' })}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-mono font-semibold transition-all"
            style={isRunning
              ? { background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }
              : { background: 'var(--low-dim)', border: '1px solid var(--low-border)', color: 'var(--low)' }
            }
          >
            {actionLoading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : isRunning ? (
              <>
                <Square size={14} />
                <span>Stop Honeypot</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Start Honeypot</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="p-6 rounded-xl max-w-sm w-full space-y-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <ShieldAlert size={24} style={{ color: confirmModal.action === 'stop' ? 'var(--crit)' : 'var(--low)' }} />
              <h3 className="text-sm font-mono font-bold" style={{ color: 'var(--tx-1)' }}>
                Confirm {confirmModal.action === 'stop' ? 'Stop' : 'Start'} Honeypot?
              </h3>
            </div>
            <p className="text-[12px] font-mono" style={{ color: 'var(--tx-3)' }}>
              Are you sure you want to {confirmModal.action === 'stop' ? 'stop the local HTTP decoy listener?' : 'start the local HTTP decoy listener on 127.0.0.1:8080?'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal({ open: false, action: 'start' })}
                className="px-3 py-1.5 rounded-lg text-[11px] font-mono"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx-4)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => executeHoneypotToggle(confirmModal.action)}
                className="px-4 py-1.5 rounded-lg text-[11px] font-mono font-bold"
                style={confirmModal.action === 'stop'
                  ? { background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }
                  : { background: 'var(--low-dim)', border: '1px solid var(--low-border)', color: 'var(--low)' }
                }
              >
                Confirm {confirmModal.action === 'stop' ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Honeypot Status"   value={isRunning ? 'ACTIVE' : 'STOPPED'} sub={isRunning ? 'Decoy traps armed' : 'Traps inactive'} accent={isRunning} />
        <StatCard label="Total Events (DB)"  value={totalInteractions} sub="Logged decoy interactions" />
        <StatCard label="Unique Attacking IPs" value={uniqueSources} sub="Top threat sources" />
        <StatCard label="Correlated Alerts" value={correlatedAlertsCount} sub="Enriched security alerts" critical={correlatedAlertsCount > 0} />
      </div>

      {/* ── CHARTS / BREAKDOWNS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <SectionHeader title="Event Type Distribution" sub="Decoy probe classification" />
          {stats?.by_event_type && Object.keys(stats.by_event_type).length > 0 ? (
            <div className="space-y-3 mt-1">
              {Object.entries(stats.by_event_type).map(([evt, count], i) => {
                const maxCount = Math.max(...Object.values(stats.by_event_type || {}), 1)
                const col = serviceColors[i % serviceColors.length]
                return (
                  <div key={evt}>
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span style={{ color: 'var(--tx-4)' }}>{evt}</span>
                      <span style={{ color: col }}>{count} events</span>
                    </div>
                    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(count / maxCount) * 100}%`, background: col, boxShadow: `0 0 4px ${col}66` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState message="No event classification telemetry recorded yet" />
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Top Attacker IPs" sub="Sources interacting with traps" />
          {stats?.top_attackers && stats.top_attackers.length > 0 ? (
            <div className="space-y-3 mt-1">
              {stats.top_attackers.slice(0, 5).map((att) => {
                const targetIp = att.ip || (att as any).source_ip || ''
                const isSelected = selectedIp === targetIp
                const hits = att.count ?? (att as any).hits ?? 0
                return (
                  <div
                    key={targetIp}
                    onClick={() => setSelectedIp(targetIp)}
                    className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors"
                    style={{
                      background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                      border: `1px solid ${isSelected ? 'var(--accent-border)' : 'var(--border)'}`,
                    }}
                  >
                    <div>
                      <IP>{targetIp || 'N/A'}</IP>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--tx-5)' }}>
                        {hits} interactions
                      </p>
                    </div>
                    <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                      Inspect IP
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState message="No attacker IP profiles recorded yet" />
          )}
        </Panel>
      </div>

      {/* ── IP CORRELATION INSPECTOR (IF SELECTED) ── */}
      {selectedIp && (
        <Panel style={{ border: '1px solid var(--accent-border)' }}>
          <SectionHeader title={`IP Correlation Inspector: ${selectedIp}`} sub="GET /honeypot/ip-correlation/{ip}">
            <button
              onClick={() => setSelectedIp(null)}
              className="text-[11px] font-mono underline"
              style={{ color: 'var(--tx-4)' }}
            >
              Close Inspector
            </button>
          </SectionHeader>

          {ipLoading ? (
            <LoadingState />
          ) : ipCorrelation ? (
            <div className="space-y-3 text-[12px] font-mono">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div>
                  <span className="text-[10px] uppercase block" style={{ color: 'var(--tx-5)' }}>Total Alerts</span>
                  <span className="font-bold text-amber-400">{ipCorrelation.total_alerts ?? 0}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase block" style={{ color: 'var(--tx-5)' }}>Honeypot Hits</span>
                  <span className="font-bold text-cyan-400">{ipCorrelation.total_honeypot_hits ?? 0}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase block" style={{ color: 'var(--tx-5)' }}>Suspicion Score</span>
                  <span className="font-bold text-red-400">{ipCorrelation.suspicion_score ?? 0} / 100</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase block" style={{ color: 'var(--tx-5)' }}>Suspicion Level</span>
                  <span className="font-bold" style={{ color: ipCorrelation.suspicion_level === 'CRITICAL' ? 'var(--crit)' : 'var(--accent)' }}>
                    {ipCorrelation.suspicion_level || 'LOW'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState message={`No correlation timeline details found for ${selectedIp}`} />
          )}
        </Panel>
      )}

      {/* ── RECENT HONEYPOT EVENTS TABLE ── */}
      <Panel>
        <SectionHeader title="Recent Honeypot Activity" sub="Live attacker interaction log (GET /honeypot/events)">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
            <span className="text-[10px] font-mono font-semibold" style={{ color: '#10b981' }}>REAL TELEMETRY</span>
          </div>
        </SectionHeader>
        {events.length > 0 ? (
          <Table headers={['Time', 'Source IP', 'Target Port', 'Service', 'Request Line', 'Severity', 'Event Type']}>
            {events.slice(0, 15).map((ev, i) => {
              const sevUpper = SEVERITY_MAP[ev.severity || 'low'] ?? 'LOW'
              return (
                <Tr key={ev.id || i} onClick={() => setSelectedIp(ev.src_ip)}>
                  <Td mono muted>{ev.timestamp ? ev.timestamp.replace('T', ' ').slice(11, 19) : 'N/A'}</Td>
                  <Td><IP>{ev.src_ip || 'N/A'}</IP></Td>
                  <Td mono>{ev.dst_port || ev.src_port || 8080}</Td>
                  <Td muted>{ev.service || 'http-decoy'}</Td>
                  <Td muted><code style={{ color: 'var(--accent)' }}>{ev.request_type || 'PROBE'}</code></Td>
                  <Td><SeverityBadge severity={sevUpper} /></Td>
                  <Td mono muted>{ev.event_type || 'SUSPICIOUS_REQUEST'}</Td>
                </Tr>
              )
            })}
          </Table>
        ) : (
          <EmptyState message="No honeypot events captured yet" />
        )}
      </Panel>
    </div>
  )
}

export { HoneypotPage }
