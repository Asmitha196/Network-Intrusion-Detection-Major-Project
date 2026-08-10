import React, { useState, useEffect } from 'react'
import axios from 'axios'
import apiClient from '../api/client'
import type { AuditLog, IncidentRules, ResponseRecommendation } from '../types'

export default function IncidentResponsePage() {
  const [blockIpInput, setBlockIpInput] = useState<string>('')
  const [reasonInput, setReasonInput] = useState<string>('')
  const [confirmed, setConfirmed] = useState<boolean>(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [rules, setRules] = useState<IncidentRules>({ firewall_rules: [], whitelist: [], blacklist: [] })
  const [recommendations, setRecommendations] = useState<ResponseRecommendation[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchRulesAndLogs = async () => {
    try {
      const [logsRes, rulesRes, recRes] = await Promise.all([
        apiClient.get<AuditLog[]>('/incident/audit-logs'),
        apiClient.get<IncidentRules>('/incident/rules'),
        apiClient.get<ResponseRecommendation[]>('/incident/recommendations'),
      ])
      setAuditLogs(logsRes.data || [])
      setRules(rulesRes.data || { firewall_rules: [], whitelist: [], blacklist: [] })
      setRecommendations(recRes.data || [])
    } catch (e) {
      console.warn('Failed to fetch incident data:', e)
    }
  }

  useEffect(() => {
    fetchRulesAndLogs()
  }, [])

  const handleApplyRecommendation = (rec: ResponseRecommendation) => {
    setBlockIpInput(rec.source_ip)
    setReasonInput(`[Recommended Action] ${rec.recommended_action} - ${rec.reason}`)
    setConfirmed(true)
    setMsg(`Recommendation for ${rec.source_ip} pre-filled below. Click 'Apply OS Firewall Block Rule' after final analyst review.`)
  }

  const handleBlockIp = async () => {
    if (!blockIpInput || !reasonInput || !confirmed) {
      setError('Please provide IP, reason, and check explicit analyst confirmation.')
      return
    }
    setError(null)
    setMsg(null)
    try {
      const res = await apiClient.post<{ message: string }>('/incident/block-ip', {
        ip_address: blockIpInput.trim(),
        reason: reasonInput.trim(),
        confirmed: true,
      })
      setMsg(res.data.message)
      setBlockIpInput('')
      setReasonInput('')
      setConfirmed(false)
      fetchRulesAndLogs()
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data?.detail) {
        setError(String(e.response.data.detail))
      } else {
        setError('Failed to block IP')
      }
    }
  }

  return (
    <div style={styles.container}>
      <div>
        <h2 style={styles.pageTitle}>Automated Incident Response & Firewall Module</h2>
        <span style={styles.pageSubtitle}>
          Apply OS Firewall rules (Windows netsh / Linux iptables), manage Whitelist/Blacklist, and track analyst action audit trails
        </span>
      </div>

      {msg && <div style={styles.successBox}>{msg}</div>}
      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Recommended Actions Panel */}
      <div style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f0f6fc', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🛡️ SYSTEM RECOMMENDED ACTIONS (ANALYST APPROVAL MANDATORY)
        </h3>

        {recommendations.length === 0 ? (
          <div style={{ color: '#8b949e', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
            No active containment recommendations. System status nominal.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recommendations.slice(0, 5).map((rec) => (
              <div key={rec.id} style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '15px', color: '#58a6ff' }}>{rec.source_ip}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: rec.risk_score >= 80 ? '#3d1419' : '#362112', color: rec.risk_score >= 80 ? '#ff7b72' : '#ffa657', border: '1px solid' }}>
                      RISK {rec.risk_score}/100 ({rec.risk_level})
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#f0f6fc', marginBottom: '4px' }}>
                    RECOMMENDED ACTION: <span style={{ color: '#ffa657' }}>{rec.recommended_action}</span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px' }}>
                    <strong>Reason:</strong> {rec.reason}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#8b949e' }}>
                    <span>Alerts: <strong style={{ color: '#c9d1d9' }}>{rec.related_evidence.total_alerts}</strong></span>
                    <span>Decoy Hits: <strong style={{ color: '#d29922' }}>{rec.related_evidence.honeypot_interactions}</strong></span>
                    <span>Attack Vectors: <strong style={{ color: '#58a6ff' }}>{rec.related_evidence.attack_types.join(', ') || 'Anomaly'}</strong></span>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => handleApplyRecommendation(rec)}
                    style={{ backgroundColor: '#238636', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                  >
                    Approve & Pre-fill Block Form
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.twoCol}>
        {/* Block IP Form */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Firewall IP Block Command Generator</h3>
          <div style={styles.formGroup}>
            <label style={styles.label}>Target IP Address:</label>
            <input
              type="text"
              style={styles.input}
              placeholder="e.g. 185.220.101.5"
              value={blockIpInput}
              onChange={(e) => setBlockIpInput(e.target.value)}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Justification / Reason:</label>
            <input
              type="text"
              style={styles.input}
              placeholder="e.g. Repeated SSH Brute Force Attack detected by Stage 1 ML"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
            />
          </div>

          <div style={styles.checkboxWrapper}>
            <input
              type="checkbox"
              id="confirmCheck"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <label htmlFor="confirmCheck" style={styles.checkLabel}>
              I confirm this firewall blocking action and assume responsibility.
            </label>
          </div>

          <button style={styles.blockButton} onClick={handleBlockIp}>
            Apply OS Firewall Block Rule
          </button>
        </div>

        {/* Active Lists */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Active Security Lists & Rules</h3>
          <div style={styles.listSection}>
            <span style={styles.listTitle}>Blacklisted Threat IPs ({rules.blacklist?.length || 0}):</span>
            <div style={styles.tagGroup}>
              {rules.blacklist?.map((ip: string) => (
                <span key={ip} style={styles.blackTag}>
                  🛑 {ip} <span style={{ color: '#ff7b72', fontSize: '11px', marginLeft: '4px', fontWeight: 700 }}>(Risk: 85/100)</span>
                </span>
              ))}
            </div>

            <span style={{ ...styles.listTitle, marginTop: '12px' }}>Whitelisted IPs ({rules.whitelist?.length || 0}):</span>
            <div style={styles.tagGroup}>
              {rules.whitelist?.map((ip: string) => (
                <span key={ip} style={styles.whiteTag}>{ip}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>SOC Analyst Action Audit Trail</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Timestamp</th>
              <th style={styles.th}>Analyst</th>
              <th style={styles.th}>Action</th>
              <th style={styles.th}>Target</th>
              <th style={styles.th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td style={styles.tdTs}>{new Date(log.timestamp).toLocaleString()}</td>
                <td style={styles.tdUser}>{log.username}</td>
                <td style={styles.tdAction}>{log.action}</td>
                <td style={styles.tdTarget}>{log.target}</td>
                <td style={styles.tdDetails}>{JSON.stringify(log.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  pageTitle: { fontSize: '20px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  pageSubtitle: { fontSize: '12px', color: '#8b949e' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  card: { backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  cardTitle: { fontSize: '15px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', color: '#8b949e', fontWeight: 600 },
  input: { backgroundColor: '#161b22', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none' },
  checkboxWrapper: { display: 'flex', alignItems: 'center', gap: '8px' },
  checkLabel: { fontSize: '12px', color: '#c9d1d9' },
  blockButton: { backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  successBox: { backgroundColor: '#064e3b33', border: '1px solid #10b981', color: '#6ee7b7', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' },
  errorBox: { backgroundColor: '#7f1d1d33', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' },
  listSection: { display: 'flex', flexDirection: 'column', gap: '6px' },
  listTitle: { fontSize: '12px', fontWeight: 700, color: '#8b949e' },
  tagGroup: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  blackTag: { backgroundColor: '#7f1d1d', color: '#fca5a5', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' },
  whiteTag: { backgroundColor: '#065f46', color: '#a7f3d0', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  th: { textAlign: 'left', padding: '8px', borderBottom: '1px solid #30363d', color: '#8b949e', fontSize: '11px', textTransform: 'uppercase' },
  tdTs: { padding: '8px', color: '#8b949e' },
  tdUser: { padding: '8px', color: '#f0f6fc', fontWeight: 600 },
  tdAction: { padding: '8px', color: '#3b82f6', fontWeight: 700 },
  tdTarget: { padding: '8px', fontFamily: 'monospace', color: '#f0f6fc' },
  tdDetails: { padding: '8px', color: '#6e7681', fontFamily: 'monospace', fontSize: '11px' },
}
