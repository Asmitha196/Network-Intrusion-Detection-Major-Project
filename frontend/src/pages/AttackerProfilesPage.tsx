import { useState, useEffect, useCallback } from 'react'
import { X, Search, RefreshCw, ChevronRight, Calendar } from 'lucide-react'
import apiClient from '../api/client'
import { StatCard, SectionHeader, Panel, SeverityBadge, IP, Table, Tr, Td, EmptyState, LoadingState, Severity } from '../components/ui'
import type { AttackerProfile, ThreatIntelData } from '../types'

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

interface TimelineEvent {
  timestamp: string
  event_type: string
  title: string
  severity: string
  details?: Record<string, any>
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

function AttackerDetailDrawer({ sourceIp, onClose }: { sourceIp: string; onClose: () => void }) {
  const [profile, setProfile] = useState<AttackerProfile | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    Promise.allSettled([
      apiClient.get<AttackerProfile>(`/attackers/${encodeURIComponent(sourceIp)}`),
      apiClient.get<TimelineEvent[]>(`/attackers/${encodeURIComponent(sourceIp)}/timeline`),
    ]).then(([profRes, timeRes]) => {
      if (!isMounted) return
      if (profRes.status === 'fulfilled') setProfile(profRes.value.data)
      if (timeRes.status === 'fulfilled') setTimeline(Array.isArray(timeRes.value.data) ? timeRes.value.data : [])
    }).finally(() => {
      if (isMounted) setLoading(false)
    })

    return () => { isMounted = false }
  }, [sourceIp])

  const intel: ThreatIntelData | undefined = profile?.threat_intelligence

  return (
    <div className="fixed inset-0 z-40 flex select-none">
      <div className="flex-1" style={{ background: 'rgba(6,9,14,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <aside className="w-full max-w-xl overflow-y-auto slide-in"
        style={{ background: 'var(--surface-2)', borderLeft: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: 'var(--tx-5)' }}>Threat Actor Profile</p>
            <h3 className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>{sourceIp}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded transition-colors" style={{ color: 'var(--tx-4)' }}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : profile ? (
          <div className="p-6 space-y-6">
            {/* Header Stats */}
            <div className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div>
                <IP>{sourceIp}</IP>
                <p className="text-[11px] font-mono mt-1" style={{ color: 'var(--tx-4)' }}>
                  {intel?.country ? `${intel.country} (${intel.city || 'Unknown City'})` : 'Global Network Host'}
                </p>
              </div>
              <RiskBadge score={profile.risk_score ?? 50} />
            </div>

            {/* Profile Detail Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                ['Source IP', profile.source_ip || profile.ip || sourceIp],
                ['Risk Score', `${profile.risk_score ?? 50} / 100`],
                ['Threat Category', intel?.threat_category || profile.risk_level || 'Suspicious Scanner'],
                ['Country', intel?.country || 'Unknown'],
                ['ASN', intel?.asn || 'N/A'],
                ['ISP', intel?.isp || 'N/A'],
                ['Total Alerts', profile.total_alerts ?? 0],
                ['Honeypot Hits', profile.honeypot_interactions ?? 0],
                ['Attack Types', profile.attack_types?.join(', ') || 'N/A'],
                ['First Seen', profile.first_seen ? profile.first_seen.replace('T', ' ').slice(0, 19) : 'N/A'],
                ['Last Seen', profile.last_seen ? profile.last_seen.replace('T', ' ').slice(0, 19) : 'N/A'],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--tx-5)' }}>{k}</p>
                  <p className="text-[12px] font-mono font-semibold" style={{ color: 'var(--tx-1)' }}>{v}</p>
                </div>
              ))}
            </div>

            {/* Chronological Timeline */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={13} style={{ color: 'var(--accent)' }} />
                <p className="text-[11px] font-mono uppercase tracking-widest font-semibold" style={{ color: 'var(--tx-3)' }}>
                  Chronological Behavior Timeline ({timeline.length})
                </p>
              </div>

              {timeline.length > 0 ? (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {timeline.map((ev, idx) => {
                    const sevUpper = SEVERITY_MAP[ev.severity || 'low'] ?? 'LOW'
                    return (
                      <div key={idx} className="p-3 rounded-lg text-[11px] font-mono"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold" style={{ color: 'var(--accent)' }}>{ev.title || ev.event_type}</span>
                          <SeverityBadge severity={sevUpper} />
                        </div>
                        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--tx-5)' }}>
                          <span>Type: {ev.event_type}</span>
                          <span>{ev.timestamp ? ev.timestamp.replace('T', ' ').slice(0, 19) : ''}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState message="No chronological timeline events recorded for this IP" />
              )}
            </div>
          </div>
        ) : (
          <EmptyState message="Attacker profile details not found" />
        )}
      </aside>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--tx-2)',
  fontSize: 12,
  fontFamily: 'JetBrains Mono, monospace',
  padding: '6px 12px',
  outline: 'none',
}

export default function AttackerProfilesPage() {
  const [profiles, setProfiles] = useState<AttackerProfile[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedIp, setSelectedIp] = useState<string | null>(null)

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get<AttackerProfile[]>('/attackers')
      setProfiles(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to fetch attacker profiles:', err)
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  // Filter profiles by search term
  const filteredProfiles = profiles.filter(p => {
    const ip = (p.source_ip || p.ip || '').toLowerCase()
    const attacks = p.attack_types?.join(' ').toLowerCase() || ''
    const s = searchTerm.toLowerCase().trim()
    return !s || ip.includes(s) || attacks.includes(s)
  })

  // Quick stats
  const totalAttacksCount = profiles.reduce((acc, p) => acc + (p.total_alerts ?? 0), 0)
  const highRiskCount = profiles.filter(p => (p.risk_score ?? 0) >= 75).length

  return (
    <div className="space-y-4 select-none">

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Threat Actors"      value={profiles.length} sub="Unique suspicious IPs" />
        <StatCard label="High-Risk Actors"  value={highRiskCount}   sub="Risk score ≥ 75" critical={highRiskCount > 0} />
        <StatCard label="Total Detections"   value={totalAttacksCount} sub="Cross-stage alerts" accent />
        <StatCard label="Decoy Interactions" value={profiles.reduce((acc, p) => acc + (p.honeypot_interactions ?? 0), 0)} sub="Honeypot hits" />
      </div>

      {/* ── ATTACKER PROFILES TABLE ── */}
      <Panel>
        <SectionHeader title="Attacker Profiles" sub="Aggregated threat actor profiles & intelligence metrics">
          <button
            onClick={fetchProfiles}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </SectionHeader>

        {/* Search input */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--tx-5)' }} />
            <input
              type="text"
              placeholder="Search Source IP or Attack Type..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 30, width: '100%' }}
            />
          </div>
        </div>

        {/* Profiles Table */}
        {loading && profiles.length === 0 ? (
          <LoadingState />
        ) : filteredProfiles.length > 0 ? (
          <Table headers={['Source IP', 'Risk Score', 'Threat Category', 'Country', 'ASN', 'Total Alerts', 'Honeypot Hits', 'First Seen', 'Last Seen', 'Action']}>
            {filteredProfiles.map(p => {
              const targetIp = p.source_ip || p.ip || '0.0.0.0'
              const intel = p.threat_intelligence
              return (
                <Tr key={targetIp} onClick={() => setSelectedIp(targetIp)}>
                  <Td><IP>{targetIp}</IP></Td>
                  <Td><RiskBadge score={p.risk_score ?? 50} /></Td>
                  <Td muted>{intel?.threat_category || p.risk_level || 'Suspicious Host'}</Td>
                  <Td mono muted>{intel?.country || 'N/A'}</Td>
                  <Td mono muted>{intel?.asn || 'N/A'}</Td>
                  <Td mono font-bold>{p.total_alerts ?? 0}</Td>
                  <Td mono muted>{p.honeypot_interactions ?? 0}</Td>
                  <Td mono muted>{p.first_seen ? p.first_seen.replace('T', ' ').slice(11, 19) : 'N/A'}</Td>
                  <Td mono muted>{p.last_seen ? p.last_seen.replace('T', ' ').slice(11, 19) : 'N/A'}</Td>
                  <Td muted>
                    <ChevronRight size={14} style={{ color: 'var(--accent)' }} />
                  </Td>
                </Tr>
              )
            })}
          </Table>
        ) : (
          <EmptyState message="No attacker profiles matching search criteria" />
        )}
      </Panel>

      {/* Attacker Detail Drawer */}
      {selectedIp && (
        <AttackerDetailDrawer
          sourceIp={selectedIp}
          onClose={() => setSelectedIp(null)}
        />
      )}
    </div>
  )
}

export { AttackerProfilesPage }
