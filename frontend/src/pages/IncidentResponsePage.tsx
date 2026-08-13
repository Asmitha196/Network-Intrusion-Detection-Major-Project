import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, Lock } from 'lucide-react'
import apiClient from '../api/client'
import { StatCard, SectionHeader, Panel, IP, Table, Tr, Td, EmptyState, LoadingState, Modal } from '../components/ui'

interface Recommendation {
  id: string
  source_ip: string
  recommended_action: string
  reason: string
  risk_score: number
  risk_level: string
  related_evidence: {
    total_alerts: number
    port_scan_count: number
    brute_force_count: number
    honeypot_interactions: number
    critical_alerts: number
    attack_types: string[]
  }
  suggested_command: string
  requires_analyst_approval: boolean
}

interface AuditLogItem {
  id: string
  timestamp: string
  username: string
  action: string
  target: string
  details: Record<string, any>
}

interface ActiveRules {
  firewall_rules: Array<{
    rule_id: string
    ip_address: string
    os_command: string
    reason: string
    created_at: string
    created_by: string
    status: string
  }>
  whitelist: string[]
  blacklist: string[]
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

export default function IncidentResponsePage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [activeRules, setActiveRules] = useState<ActiveRules | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Block Modal state
  const [blockModalOpen, setBlockModalOpen] = useState<boolean>(false)
  const [targetIp, setTargetIp] = useState<string>('')
  const [blockReason, setBlockReason] = useState<string>('')
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false)
  const [blockActionLoading, setBlockActionLoading] = useState<boolean>(false)

  // Whitelist / Blacklist action state
  const [actionLoadingIp, setActionLoadingIp] = useState<string | null>(null)

  // Load recommendations, active rules, and audit logs
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [recsRes, rulesRes, auditRes] = await Promise.allSettled([
        apiClient.get<Recommendation[]>('/incident/recommendations'),
        apiClient.get<ActiveRules>('/incident/rules'),
        apiClient.get<AuditLogItem[]>('/incident/audit-logs'),
      ])

      if (recsRes.status === 'fulfilled') setRecommendations(Array.isArray(recsRes.value.data) ? recsRes.value.data : [])
      if (rulesRes.status === 'fulfilled') setActiveRules(rulesRes.value.data)
      if (auditRes.status === 'fulfilled') setAuditLogs(Array.isArray(auditRes.value.data) ? auditRes.value.data : [])
    } catch (err) {
      console.error('Failed to load incident response telemetry:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Open Block Confirmation Modal
  const openBlockModal = (rec: Recommendation) => {
    setTargetIp(rec.source_ip)
    setBlockReason(rec.reason || `Analyst block rule for IP ${rec.source_ip}`)
    setIsConfirmed(false)
    setBlockModalOpen(true)
  }

  // Execute Block IP API call (POST /incident/block-ip)
  const handleBlockConfirm = async () => {
    if (!isConfirmed) {
      alert('You must check the confirmation checkbox to explicitly authorize firewall blocking.')
      return
    }

    try {
      setBlockActionLoading(true)
      await apiClient.post('/incident/block-ip', {
        ip_address: targetIp,
        reason: blockReason,
        confirmed: true,
      })

      alert(`Successfully added OS Firewall Block rule for ${targetIp}`)
      setBlockModalOpen(false)
      fetchData()
    } catch (err: any) {
      console.error(`Failed to block IP ${targetIp}:`, err)
      alert(`Firewall block failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setBlockActionLoading(false)
    }
  }

  // Whitelist IP (POST /incident/whitelist-ip)
  const handleWhitelist = async (ip: string) => {
    try {
      setActionLoadingIp(ip)
      await apiClient.post('/incident/whitelist-ip', {
        ip_address: ip,
        notes: 'Added via SOC Incident Response dashboard',
      })
      fetchData()
    } catch (err: any) {
      console.error(`Failed to whitelist IP ${ip}:`, err)
      alert(`Whitelist failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setActionLoadingIp(null)
    }
  }

  // Blacklist IP (POST /incident/blacklist-ip)
  const handleBlacklist = async (ip: string) => {
    try {
      setActionLoadingIp(ip)
      await apiClient.post('/incident/blacklist-ip', {
        ip_address: ip,
        notes: 'Added via SOC Incident Response dashboard',
      })
      fetchData()
    } catch (err: any) {
      console.error(`Failed to blacklist IP ${ip}:`, err)
      alert(`Blacklist failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setActionLoadingIp(null)
    }
  }

  return (
    <div className="space-y-4 select-none">

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pending Recommendations" value={recommendations.length} sub="Requires analyst review" critical={recommendations.length > 0} />
        <StatCard label="Active Firewall Rules"   value={activeRules?.firewall_rules?.length ?? 0} sub="OS netsh/iptables blocks" accent />
        <StatCard label="Whitelisted IPs"          value={activeRules?.whitelist?.length ?? 0} sub="Trusted LAN & loopback" />
        <StatCard label="Blacklisted IPs"          value={activeRules?.blacklist?.length ?? 0} sub="Denied threat actors" critical={(activeRules?.blacklist?.length ?? 0) > 0} />
      </div>

      {/* ── RECOMMENDATIONS TABLE ── */}
      <Panel>
        <SectionHeader title="Contextual Response Recommendations" sub="Non-automated containment guidance requiring explicit analyst approval">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </SectionHeader>

        {loading && recommendations.length === 0 ? (
          <LoadingState />
        ) : recommendations.length > 0 ? (
          <Table headers={['Target IP', 'Risk Score', 'Recommended Action', 'Reason / Evidence', 'Evidence Breakdown', 'Analyst Actions']}>
            {recommendations.map(rec => {
              const ev = rec.related_evidence
              const isActioning = actionLoadingIp === rec.source_ip
              return (
                <Tr key={rec.id}>
                  <Td><IP>{rec.source_ip}</IP></Td>
                  <Td><RiskBadge score={rec.risk_score} /></Td>
                  <Td font-bold>{rec.recommended_action}</Td>
                  <Td muted>{rec.reason}</Td>
                  <Td mono muted>
                    Alerts: {ev?.total_alerts ?? 0} | Crit: {ev?.critical_alerts ?? 0} | Decoy: {ev?.honeypot_interactions ?? 0}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openBlockModal(rec)}
                        disabled={isActioning}
                        className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all"
                        style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }}
                      >
                        Block IP
                      </button>
                      <button
                        onClick={() => handleWhitelist(rec.source_ip)}
                        disabled={isActioning}
                        className="px-2.5 py-1 rounded text-[11px] font-mono transition-all"
                        style={{ background: 'var(--low-dim)', border: '1px solid var(--low-border)', color: 'var(--low)' }}
                      >
                        Whitelist
                      </button>
                      <button
                        onClick={() => handleBlacklist(rec.source_ip)}
                        disabled={isActioning}
                        className="px-2.5 py-1 rounded text-[11px] font-mono transition-all"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
                      >
                        Blacklist
                      </button>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </Table>
        ) : (
          <EmptyState message="No pending response recommendations requiring analyst containment" />
        )}
      </Panel>

      {/* ── ACTIVE RULES & LISTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <SectionHeader title="Active OS Firewall Rules" sub="Enforced netsh advfirewall & iptables blocks" />
          {activeRules?.firewall_rules && activeRules.firewall_rules.length > 0 ? (
            <div className="space-y-2 text-[11px] font-mono">
              {activeRules.firewall_rules.map(rule => (
                <div key={rule.rule_id} className="p-3 rounded-lg flex items-center justify-between"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <IP>{rule.ip_address}</IP>
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold"
                        style={{ background: 'var(--crit-dim)', color: 'var(--crit)' }}>
                        {rule.status}
                      </span>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--tx-4)' }}>{rule.reason}</p>
                    <code className="text-[10px] text-cyan-400 block mt-0.5">{rule.os_command}</code>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No active OS firewall block rules applied" />
          )}
        </Panel>

        <Panel>
          <SectionHeader title="SOC Audit Trail History" sub="Complete log of analyst containment actions" />
          {auditLogs.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-[11px] font-mono">
              {auditLogs.slice(0, 15).map(log => (
                <div key={log.id} className="p-2.5 rounded-lg flex items-center justify-between"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>{log.action}</span>
                      <span style={{ color: 'var(--tx-2)' }}>Target: {log.target}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--tx-5)' }}>By analyst: {log.username}</span>
                  </div>
                  <span style={{ color: 'var(--tx-5)' }}>{log.timestamp ? log.timestamp.replace('T', ' ').slice(0, 19) : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No audit trail events recorded" />
          )}
        </Panel>
      </div>

      {/* ── EXPLICIT ANALYST BLOCK CONFIRMATION MODAL ── */}
      {blockModalOpen && (
        <Modal title={`Authorize OS Firewall Block: ${targetIp}`} onClose={() => setBlockModalOpen(false)}>
          <div className="space-y-4 text-[12px] font-mono">
            <div className="p-3 rounded-lg flex items-start gap-2.5"
              style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)' }}>
              <AlertTriangle size={18} style={{ color: 'var(--crit)', flexShrink: 0 }} />
              <div>
                <p className="font-bold" style={{ color: 'var(--crit)' }}>Explicit Analyst Confirmation Required</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
                  NIDS requires explicit human analyst approval before executing firewall containment rules.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--tx-5)' }}>
                Target IP Address
              </label>
              <input
                type="text"
                disabled
                value={targetIp}
                className="w-full p-2.5 rounded-lg text-[13px] outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--accent)' }}
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--tx-5)' }}>
                Justification / Reason
              </label>
              <textarea
                rows={2}
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                className="w-full p-2.5 rounded-lg text-[12px] outline-none resize-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-1)' }}
              />
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                id="explicitConfirm"
                checked={isConfirmed}
                onChange={e => setIsConfirmed(e.target.checked)}
                className="w-4 h-4"
                style={{ accentColor: 'var(--crit)' }}
              />
              <label htmlFor="explicitConfirm" className="cursor-pointer text-[11px] font-semibold" style={{ color: 'var(--tx-1)' }}>
                I explicitly confirm OS firewall blocking of IP address {targetIp}
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBlockModalOpen(false)}
                className="px-4 py-2 rounded-lg text-[12px]"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleBlockConfirm}
                disabled={!isConfirmed || blockActionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-40"
                style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }}
              >
                {blockActionLoading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <>
                    <Lock size={14} />
                    <span>Apply Firewall Block</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
