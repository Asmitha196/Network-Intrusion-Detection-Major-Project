import React, { useState } from 'react'
import axios from 'axios'
import apiClient from '../api/client'
import type { ThreatIntelData } from '../types'

export default function ThreatIntelPage() {
  const [ipInput, setIpInput] = useState<string>('185.220.101.5')
  const [intel, setIntel] = useState<ThreatIntelData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleLookup = async (ipToSearch?: string) => {
    const target = ipToSearch || ipInput
    if (!target) return

    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ThreatIntelData>(`/threat-intel/lookup/${target.trim()}`)
      setIntel(res.data)
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data?.detail) {
        setError(String(e.response.data.detail))
      } else {
        setError('Failed to fetch threat intelligence')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div>
        <h2 style={styles.pageTitle}>Threat Intelligence & IP Reputation</h2>
        <span style={styles.pageSubtitle}>
          Enrich external IP addresses with AbuseIPDB, VirusTotal, and MaxMind GeoIP metadata (RFC1918 Private IPs auto-filtered)
        </span>
      </div>

      {/* Search Input Bar */}
      <div style={styles.searchBar}>
        <input
          type="text"
          style={styles.input}
          placeholder="Enter IPv4 / IPv6 address (e.g. 185.220.101.5)..."
          value={ipInput}
          onChange={(e) => setIpInput(e.target.value)}
        />
        <button style={styles.button} onClick={() => handleLookup()} disabled={loading}>
          {loading ? 'Searching...' : 'Enrich Threat Intel'}
        </button>

        <div style={styles.sampleButtons}>
          <span style={styles.sampleLabel}>Quick Samples:</span>
          <button style={styles.sampleBtn} onClick={() => { setIpInput('185.220.101.5'); handleLookup('185.220.101.5'); }}>185.220.101.5 (Tor)</button>
          <button style={styles.sampleBtn} onClick={() => { setIpInput('193.56.29.11'); handleLookup('193.56.29.11'); }}>193.56.29.11 (Botnet C2)</button>
          <button style={styles.sampleBtn} onClick={() => { setIpInput('192.168.10.50'); handleLookup('192.168.10.50'); }}>192.168.10.50 (LAN)</button>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Threat Intelligence Result Card */}
      {intel && (
        <div style={styles.resultGrid}>
          {/* Overview Card */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.ipTitle}>{intel.ip}</h3>
                <span style={styles.orgText}>{intel.organization} — {intel.isp}</span>
              </div>
              <span
                style={{
                  ...styles.maliciousBadge,
                  backgroundColor: intel.known_malicious ? '#dc2626' : '#059669',
                }}
              >
                {intel.known_malicious ? 'MALICIOUS THREAT' : 'CLEAN / TRUSTED'}
              </span>
            </div>

            <div style={styles.metricsRow}>
              <div style={styles.metricBox}>
                <span style={styles.metricLabel}>Abuse Confidence Score</span>
                <span style={{ ...styles.metricVal, color: intel.abuse_score > 50 ? '#ef4444' : '#10b981' }}>
                  {intel.abuse_score}%
                </span>
              </div>

              <div style={styles.metricBox}>
                <span style={styles.metricLabel}>Reputation Score</span>
                <span style={{ ...styles.metricVal, color: intel.reputation_score < 50 ? '#ef4444' : '#10b981' }}>
                  {intel.reputation_score} / 100
                </span>
              </div>

              <div style={styles.metricBox}>
                <span style={styles.metricLabel}>Category</span>
                <span style={styles.metricValText}>{intel.threat_category}</span>
              </div>
            </div>
          </div>

          {/* GeoIP Details Card */}
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Geolocation & ASN Metadata</h3>
            <div style={styles.detailsList}>
              <div style={styles.detailItem}>
                <span style={styles.dLabel}>Country:</span>
                <span style={styles.dVal}>{intel.country}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.dLabel}>City:</span>
                <span style={styles.dVal}>{intel.city}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.dLabel}>Coordinates:</span>
                <span style={styles.dVal}>{intel.latitude}, {intel.longitude}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.dLabel}>Autonomous System (ASN):</span>
                <span style={styles.dVal}>{intel.asn}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.dLabel}>Private IP (RFC1918):</span>
                <span style={styles.dVal}>{intel.is_private ? 'Yes (Local Network)' : 'No (Public WAN)'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  pageTitle: { fontSize: '20px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  pageSubtitle: { fontSize: '12px', color: '#8b949e' },
  searchBar: { backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' },
  input: { flex: 1, minWidth: '240px', backgroundColor: '#161b22', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', outline: 'none' },
  button: { backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' },
  sampleButtons: { display: 'flex', alignItems: 'center', gap: '8px' },
  sampleLabel: { fontSize: '11px', color: '#8b949e' },
  sampleBtn: { backgroundColor: '#21262d', color: '#58a6ff', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' },
  errorBox: { backgroundColor: '#7f1d1d33', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '6px', fontSize: '13px' },
  resultGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' },
  card: { backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  ipTitle: { fontSize: '22px', fontWeight: 700, color: '#f0f6fc', margin: 0, fontFamily: 'monospace' },
  orgText: { fontSize: '12px', color: '#8b949e' },
  maliciousBadge: { color: '#fff', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', textTransform: 'uppercase' },
  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  metricBox: { backgroundColor: '#161b22', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' },
  metricLabel: { fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 700 },
  metricVal: { fontSize: '22px', fontWeight: 700 },
  metricValText: { fontSize: '13px', fontWeight: 600, color: '#f0f6fc' },
  sectionTitle: { fontSize: '15px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  detailsList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  detailItem: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #161b22', paddingBottom: '6px' },
  dLabel: { color: '#8b949e' },
  dVal: { color: '#f0f6fc', fontWeight: 600 },
}
