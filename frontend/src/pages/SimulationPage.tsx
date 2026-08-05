import React, { useState } from 'react'
import axios from 'axios'
import apiClient from '../api/client'
import type { SimulationResult } from '../types'

export default function SimulationPage() {
  const [selectedAttack, setSelectedAttack] = useState<string>('Port Scan')
  const [packetCount, setPacketCount] = useState<number>(100)
  const [targetIp, setTargetIp] = useState<string>('172.16.0.5')
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const attacks = [
    { name: 'Port Scan', desc: 'Rapid SYN scanning across sequential ports', category: 'Reconnaissance' },
    { name: 'SYN Flood', desc: 'High-volume TCP SYN flood targeting socket exhaustion', category: 'DoS / DDoS' },
    { name: 'ICMP Flood', desc: 'ICMP Echo Request ping storm', category: 'DoS / DDoS' },
    { name: 'UDP Flood', desc: 'UDP packet flood targeting high-bandwidth depletion', category: 'DoS / DDoS' },
    { name: 'Brute Force', desc: 'SSH/FTP credential brute force attempt', category: 'Unauthorized Access' },
    { name: 'DNS Flood', desc: 'High-volume DNS query flood', category: 'Application DoS' },
    { name: 'HTTP Flood', desc: 'Layer 7 HTTP GET/POST flood', category: 'Web Attack' },
    { name: 'Slowloris', desc: 'Slow HTTP request headers holding connections open', category: 'Web DoS' },
  ]

  const handleRunSimulation = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiClient.post<SimulationResult>('/simulation/run', {
        attack_type: selectedAttack,
        packet_count: packetCount,
        target_ip: targetIp,
      })
      setResult(res.data)
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data?.detail) {
        setError(String(e.response.data.detail))
      } else {
        setError('Simulation execution failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div>
        <h2 style={styles.pageTitle}>Security Attack Simulation Lab</h2>
        <span style={styles.pageSubtitle}>
          Safely demonstrate live attack patterns and evaluate real-time hybrid ML pipeline detection in a sandbox
        </span>
      </div>

      <div style={styles.twoCol}>
        {/* Control Panel */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Attack Vector Configuration</h3>

          <div style={styles.gridAttacks}>
            {attacks.map((atk) => (
              <div
                key={atk.name}
                style={{
                  ...styles.atkBox,
                  borderColor: selectedAttack === atk.name ? '#3b82f6' : '#21262d',
                  backgroundColor: selectedAttack === atk.name ? '#1e293b' : '#161b22',
                }}
                onClick={() => setSelectedAttack(atk.name)}
              >
                <div style={styles.atkHeader}>
                  <span style={styles.atkName}>{atk.name}</span>
                  <span style={styles.atkCat}>{atk.category}</span>
                </div>
                <span style={styles.atkDesc}>{atk.desc}</span>
              </div>
            ))}
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Simulated Packets Count:</label>
              <input
                type="number"
                style={styles.input}
                value={packetCount}
                onChange={(e) => setPacketCount(parseInt(e.target.value) || 100)}
                min={10}
                max={5000}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Target Victim IP:</label>
              <input
                type="text"
                style={styles.input}
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
              />
            </div>
          </div>

          <button style={styles.runButton} onClick={handleRunSimulation} disabled={loading}>
            {loading ? 'Executing Attack Vector...' : `Run Safe ${selectedAttack} Demonstration`}
          </button>

          {error && <div style={styles.errorBox}>{error}</div>}
        </div>

        {/* Results Panel */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Real-time Detection Telemetry Result</h3>

          {result ? (
            <div style={styles.resultGroup}>
              <div style={styles.statusBadge}>
                <span style={styles.statusDot} />
                <span>SIMULATION STATUS: {result.status}</span>
              </div>

              <div style={styles.resGrid}>
                <div style={styles.resBox}>
                  <span style={styles.resLabel}>Packets Generated</span>
                  <span style={styles.resVal}>{result.packets_generated}</span>
                </div>

                <div style={styles.resBox}>
                  <span style={styles.resLabel}>Flows Generated</span>
                  <span style={styles.resVal}>{result.flows_generated}</span>
                </div>

                <div style={styles.resBox}>
                  <span style={styles.resLabel}>Execution Time</span>
                  <span style={styles.resVal}>{result.detection_time_ms} ms</span>
                </div>
              </div>

              <div style={styles.detectionDetails}>
                <div style={styles.detRow}>
                  <span style={styles.detLabel}>Stage 1 RandomForest Detection:</span>
                  <span style={{ ...styles.detVal, color: '#3b82f6' }}>{result.known_attack_result}</span>
                </div>

                <div style={styles.detRow}>
                  <span style={styles.detLabel}>Stage 2 Autoencoder Evaluation:</span>
                  <span style={{ ...styles.detVal, color: '#a855f7' }}>{result.unknown_attack_result}</span>
                </div>
              </div>

              <div style={styles.infoNote}>
                Flow feature vectors were pushed directly into Redis Stream <code>ids:flows</code>.
                Check the SOC Dashboard and Alerts tab to inspect generated detections!
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>
              Select an attack pattern and click <strong>Run Demonstration</strong> to execute and evaluate detection telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  pageTitle: { fontSize: '20px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  pageSubtitle: { fontSize: '12px', color: '#8b949e' },
  twoCol: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' },
  card: { backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  cardTitle: { fontSize: '15px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  gridAttacks: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  atkBox: { border: '1px solid #21262d', borderRadius: '6px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' },
  atkHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  atkName: { fontSize: '12px', fontWeight: 700, color: '#f0f6fc' },
  atkCat: { fontSize: '9px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' },
  atkDesc: { fontSize: '10px', color: '#8b949e' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '11px', color: '#8b949e', fontWeight: 600 },
  input: { backgroundColor: '#161b22', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', outline: 'none' },
  runButton: { backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' },
  errorBox: { backgroundColor: '#7f1d1d33', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '12px' },
  resultGroup: { display: 'flex', flexDirection: 'column', gap: '14px' },
  statusBadge: { backgroundColor: '#064e3b33', border: '1px solid #10b981', color: '#6ee7b7', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  resBox: { backgroundColor: '#161b22', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' },
  resLabel: { fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 700 },
  resVal: { fontSize: '18px', fontWeight: 700, color: '#f0f6fc' },
  detectionDetails: { backgroundColor: '#161b22', padding: '12px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' },
  detRow: { display: 'flex', justifyContent: 'space-between', fontSize: '12px' },
  detLabel: { color: '#8b949e' },
  detVal: { fontWeight: 700 },
  infoNote: { backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' },
  emptyState: { color: '#6e7681', fontSize: '13px', textAlign: 'center', padding: '40px 0' },
}
