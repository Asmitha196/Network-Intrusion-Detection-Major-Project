import { useState, useEffect, useCallback } from 'react'
import { X, AlertCircle, Clock, CheckCircle2, RefreshCw, Filter, ChevronRight } from 'lucide-react'
import apiClient from '../api/client'
import { StatCard, SectionHeader, Panel, IP, Table, Tr, Td, EmptyState, LoadingState } from '../components/ui'
import { useWebSocket } from '../hooks/useWebSocket'
import type { CorrelatedIncident, HoneypotEvent, WebSocketMessage } from '../types'

const STATUS_OPTIONS: Array<'NEW' | 'INVESTIGATING' | 'RESOLVED'> = ['NEW', 'INVESTIGATING', 'RESOLVED']

function StatusBadge({ status }: { status: string }) {
  const s = String(status).toUpperCase()
  if (s === 'RESOLVED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold"
        style={{ background: 'var(--low-dim)', border: '1px solid var(--low-border)', color: 'var(--low)' }}>
        <CheckCircle2 size={10} />
        <span>RESOLVED</span>
      </span>
    )
  }
  if (s === 'INVESTIGATING') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold"
        style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>
        <Clock size={10} />
        <span>INVESTIGATING</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold animate-pulse"
      style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }}>
      <AlertCircle size={10} />
      <span>NEW</span>
    </span>
  )
}

function RiskBadge({ score }: { score: number }) {
  const isHigh = score >= 75
  const isMed = score >= 40 && score < 75
  const col = isHigh ? 'var(--crit)' : isMed ? 'var(--high)' : 'var(--low)'
  const bg = isHigh ? 'var(--crit-dim)' : isMed ? 'var(--high-dim)' : 'var(--low-dim)'
  const border = isHigh ? 'var(--crit-border)' : isMed ? 'var(--high-border)' : 'var(--low-border)'

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold"
      style={{ background: bg, border: `1px solid ${border}`, color: col }}>
      Risk {score}
    </span>
  )
}

function IncidentDrawer({ incidentId, onClose, onStatusChange }: {
  incidentId: string; onClose: () => void; onStatusChange: (id: string, newStatus: string) => void
}) {
  const [incident, setIncident] = useState<CorrelatedIncident | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [updating, setUpdating] = useState<boolean>(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    apiClient.get<CorrelatedIncident>(`/incidents/${incidentId}`)
      .then(res => {
        if (isMounted) setIncident(res.data)
      })
      .catch(err => {
        console.error(`Failed to fetch incident ${incidentId}:`, err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [incidentId])

  const handleUpdateStatus = async (newStatus: string) => {
    if (!incident) return
    try {
      setUpdating(true)
      await apiClient.patch(`/incidents/${incident.id}/status`, { status: newStatus })
      setIncident(prev => prev ? { ...prev, status: newStatus as any } : prev)
      onStatusChange(incident.id, newStatus)
    } catch (err: any) {
      console.error(`Failed to update status for incident ${incident.id}:`, err)
      alert(`Status update failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex select-none">
      <div className="flex-1" style={{ background: 'rgba(6,9,14,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <aside className="w-full max-w-xl overflow-y-auto slide-in"
        style={{ background: 'var(--surface-2)', borderLeft: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: 'var(--tx-5)' }}>Incident Detail</p>
            <h3 className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>{incidentId}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded transition-colors" style={{ color: 'var(--tx-4)' }}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : incident ? (
          <div className="p-6 space-y-6">
            {/* Status Switcher & Controls */}
            <div className="flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-5)' }}>
                  Current Status
                </span>
                <StatusBadge status={incident.status} />
              </div>
              <div className="flex items-center gap-1.5">
                {STATUS_OPTIONS.map(st => (
                  <button
                    key={st}
                    disabled={updating || incident.status === st}
                    onClick={() => handleUpdateStatus(st)}
                    className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all disabled:opacity-40"
                    style={incident.status === st
                      ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }
                      : { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-4)' }
                    }
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Incident Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                ['Source IP', incident.source_ip],
                ['Destination IP', incident.destination_ip || 'Internal Network'],
                ['Risk Score', incident.risk_score],
                ['Alert Count', incident.alert_count],
                ['Honeypot Hits', incident.honeypot_interactions ?? 0],
                ['Attack Types', incident.attack_types?.join(', ') || 'N/A'],
                ['Start Time', incident.start_time ? incident.start_time.replace('T', ' ').slice(0, 19) : 'N/A'],
                ['Last Activity', incident.last_activity ? incident.last_activity.replace('T', ' ').slice(0, 19) : 'N/A'],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--tx-5)' }}>{k}</p>
                  <p className="text-[12px] font-mono font-semibold" style={{ color: 'var(--tx-1)' }}>{v}</p>
                </div>
              ))}
            </div>

            {/* Linked Stage 1 & Stage 2 Alerts */}
            <div>
              <p className="text-[11px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--tx-4)' }}>
                Linked Stage 1 & 2 Alerts ({incident.linked_alerts?.length ?? 0})
              </p>
              {incident.linked_alerts && incident.linked_alerts.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {incident.linked_alerts.map(al => (
                    <div key={al.id} className="p-2.5 rounded-lg text-[11px] font-mono flex items-center justify-between"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div>
                        <span style={{ color: 'var(--accent)' }}>{al.attack_type || 'Anomaly'}</span>
                        <span className="text-[10px] ml-2" style={{ color: 'var(--tx-5)' }}>Stage {al.stage}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span style={{ color: 'var(--tx-4)' }}>{(al.severity as string).toUpperCase()}</span>
                        <span style={{ color: 'var(--tx-5)' }}>{al.timestamp ? al.timestamp.slice(11, 19) : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No linked detection alerts attached to this incident" />
              )}
            </div>

            {/* Honeypot Interaction Log */}
            <div>
              <p className="text-[11px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--tx-4)' }}>
                Honeypot Decoy Events ({incident.honeypot_events?.length ?? 0})
              </p>
              {incident.honeypot_events && incident.honeypot_events.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {incident.honeypot_events.map((hp: HoneypotEvent, idx: number) => (
                    <div key={hp.id || idx} className="p-2.5 rounded-lg text-[11px] font-mono flex items-center justify-between"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div>
                        <span style={{ color: 'var(--crit)' }}>{hp.service || hp.event_type || 'Decoy Probe'}</span>
                        {hp.request_type && <span className="text-[10px] ml-2" style={{ color: 'var(--tx-5)' }}>({hp.request_type})</span>}
                      </div>
                      <span style={{ color: 'var(--tx-5)' }}>{hp.timestamp ? hp.timestamp.slice(11, 19) : ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No honeypot interactions captured for this attacker IP" />
              )}
            </div>
          </div>
        ) : (
          <EmptyState message="Incident details not found" />
        )}
      </aside>
    </div>
  )
}

export default function CorrelatedIncidentsPage() {
  const [incidents, setIncidents] = useState<CorrelatedIncident[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)

  // WebSockets stream `/ws/alerts` for incident triggers
  const { lastMessage: wsMsg } = useWebSocket<WebSocketMessage>('/ws/alerts')

  // Fetch incidents list from GET /incidents
  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = {}
      if (statusFilter !== 'ALL') params.status = statusFilter

      const res = await apiClient.get<CorrelatedIncident[]>('/incidents', { params })
      setIncidents(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to fetch correlated incidents:', err)
      setIncidents([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  // Handle incoming real-time incident WebSocket updates
  useEffect(() => {
    if (!wsMsg) return
    fetchIncidents()
  }, [wsMsg, fetchIncidents])

  // Update status in local state when patched
  const handleStatusChanged = (id: string, newStatus: string) => {
    setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, status: newStatus as any } : inc))
  }

  // Quick stats
  const newCount = incidents.filter(i => String(i.status).toUpperCase() === 'NEW').length
  const invCount = incidents.filter(i => String(i.status).toUpperCase() === 'INVESTIGATING').length
  const resCount = incidents.filter(i => String(i.status).toUpperCase() === 'RESOLVED').length

  return (
    <div className="space-y-4 select-none">

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Incidents"   value={incidents.length} sub="Correlated attack clusters" />
        <StatCard label="New Alerts"        value={newCount}          sub="Requires triage" critical={newCount > 0} />
        <StatCard label="Investigating"     value={invCount}          sub="Under active review" accent={invCount > 0} />
        <StatCard label="Resolved"          value={resCount}          sub="Remediated incidents" />
      </div>

      {/* ── INCIDENTS LIST ── */}
      <Panel>
        <SectionHeader title="Correlated Security Incidents" sub="Cross-stage attack graph correlation engine">
          <button
            onClick={fetchIncidents}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </SectionHeader>

        {/* Status Filter */}
        <div className="flex items-center gap-2 mb-4">
          <Filter size={12} style={{ color: 'var(--tx-5)' }} />
          <span className="text-[11px] font-mono" style={{ color: 'var(--tx-5)' }}>Status:</span>
          {['ALL', 'NEW', 'INVESTIGATING', 'RESOLVED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all"
              style={statusFilter === st
                ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }
                : { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-4)' }
              }
            >
              {st}
            </button>
          ))}
        </div>

        {/* Incidents Table */}
        {loading && incidents.length === 0 ? (
          <LoadingState />
        ) : incidents.length > 0 ? (
          <Table headers={['Incident ID', 'Source IP', 'Dest IP', 'Risk Score', 'Alerts', 'Honeypot Hits', 'Attack Vectors', 'Status', 'Last Activity', 'Action']}>
            {incidents.map(inc => (
              <Tr key={inc.id} onClick={() => setSelectedIncidentId(inc.id)}>
                <Td mono muted>{inc.id.slice(0, 8)}...</Td>
                <Td><IP>{inc.source_ip || 'N/A'}</IP></Td>
                <Td mono muted>{inc.destination_ip || 'LAN'}</Td>
                <Td><RiskBadge score={inc.risk_score ?? 50} /></Td>
                <Td mono font-bold>{inc.alert_count ?? 0}</Td>
                <Td mono muted>{inc.honeypot_interactions ?? 0}</Td>
                <Td muted>{inc.attack_types?.join(', ') || 'Multi-Vector'}</Td>
                <Td><StatusBadge status={inc.status} /></Td>
                <Td mono muted>{inc.last_activity ? inc.last_activity.replace('T', ' ').slice(11, 19) : 'N/A'}</Td>
                <Td muted>
                  <ChevronRight size={14} style={{ color: 'var(--accent)' }} />
                </Td>
              </Tr>
            ))}
          </Table>
        ) : (
          <EmptyState message="No correlated security incidents found matching filter" />
        )}
      </Panel>

      {/* Incident Details Drawer */}
      {selectedIncidentId && (
        <IncidentDrawer
          incidentId={selectedIncidentId}
          onClose={() => setSelectedIncidentId(null)}
          onStatusChange={handleStatusChanged}
        />
      )}
    </div>
  )
}

export { CorrelatedIncidentsPage }
