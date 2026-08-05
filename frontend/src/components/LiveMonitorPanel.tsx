import { useState, useEffect, useCallback } from 'react'
import apiClient from '../api/client'
import type { NetworkInterface, MonitorStatus, Alert } from '../types'

interface LiveMonitorPanelProps {
  onAlertSelect?: (alert: Alert) => void
}

const DEFAULT_INTERFACES: NetworkInterface[] = [
  { name: 'Wi-Fi', description: 'Wi-Fi Network Adapter', mac_address: 'N/A', ip_address: 'Active NIC', status: 'up', speed: 'N/A' },
  { name: 'Ethernet', description: 'Ethernet Network Adapter', mac_address: 'N/A', ip_address: 'LAN', status: 'up', speed: 'N/A' },
]

export default function LiveMonitorPanel({ onAlertSelect: _onAlertSelect }: LiveMonitorPanelProps) {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>(DEFAULT_INTERFACES)
  const [selectedIface, setSelectedIface] = useState<string>('Wi-Fi')
  const [status, setStatus] = useState<MonitorStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Fetch available network interfaces
  const fetchInterfaces = useCallback(async () => {
    try {
      const res = await apiClient.get<NetworkInterface[]>('/interfaces')
      const ifacesList = res.data || []
      if (ifacesList.length > 0) {
        setInterfaces(ifacesList)
        setSelectedIface((prev) => {
          if (prev && ifacesList.some((i) => i.name === prev)) {
            return prev
          }
          const active = ifacesList.find(
            (i) => i.status === 'up' && i.ip_address !== '0.0.0.0' && i.ip_address !== '127.0.0.1'
          )
          return active ? active.name : ifacesList[0].name
        })
      }
    } catch (e) {
      console.warn('Failed to fetch network interfaces:', e)
    }
  }, [])

  // Fetch live capture telemetry & status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<MonitorStatus>('/monitor/status')
      setStatus(res.data)
      if (res.data.error_message) {
        setErrorMsg(res.data.error_message)
      } else {
        setErrorMsg(null)
      }
      if (res.data.interface && res.data.active) {
        setSelectedIface(res.data.interface)
      }
    } catch (e) {
      console.warn('Failed to fetch monitor status:', e)
    }
  }, [])

  useEffect(() => {
    fetchInterfaces()
    fetchStatus()
    const timer = window.setInterval(fetchStatus, 2000)
    return () => window.clearInterval(timer)
  }, [fetchInterfaces, fetchStatus])

  const handleStart = async () => {
    const ifaceToUse = selectedIface || (interfaces.length > 0 ? interfaces[0].name : 'Wi-Fi')
    setLoading(true)
    setErrorMsg(null)
    try {
      await apiClient.post('/monitor/start', { interface: ifaceToUse })
      await fetchStatus()
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
        (e as Error)?.message ||
        'Failed to start live monitoring'
      setErrorMsg(detail)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      await apiClient.post('/monitor/stop')
      await fetchStatus()
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ||
        (e as Error)?.message ||
        'Failed to stop live monitoring'
      setErrorMsg(detail)
    } finally {
      setLoading(false)
    }
  }

  const formatBandwidth = (bps: number): string => {
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} Kbps`
    return `${bps.toFixed(0)} bps`
  }

  const isActive = status?.active ?? false

  return (
    <div style={styles.container}>
      {/* Top Header & Controls */}
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={styles.statusBadgeGroup}>
            <span
              style={{
                ...styles.statusDot,
                backgroundColor: isActive ? '#10b981' : '#6e7681',
                boxShadow: isActive ? '0 0 8px #10b981' : 'none',
              }}
            />
            <span style={styles.statusText}>
              {isActive ? 'LIVE MONITORING ACTIVE' : 'LIVE MONITORING STOPPED'}
            </span>
          </div>
          <span style={styles.subText}>
            Continuous real-time packet capture & dual-stage ML detection
          </span>
        </div>

        <div style={styles.controlGroup}>
          <div style={styles.selectWrapper}>
            <label style={styles.label}>Interface:</label>
            <select
              style={styles.select}
              value={selectedIface}
              disabled={isActive || loading}
              onChange={(e) => setSelectedIface(e.target.value)}
            >
              {interfaces.map((iface) => (
                <option key={iface.name} value={iface.name}>
                  {iface.name} ({iface.ip_address} - {iface.status})
                </option>
              ))}
            </select>
          </div>

          {isActive ? (
            <button
              style={{ ...styles.button, backgroundColor: '#dc2626' }}
              onClick={handleStop}
              disabled={loading}
            >
              {loading ? 'Stopping...' : 'Stop Monitoring'}
            </button>
          ) : (
            <button
              style={{ ...styles.button, backgroundColor: '#10b981' }}
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? 'Starting...' : 'Start Monitoring'}
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Message */}
      {errorMsg && <div style={styles.errorAlert}>{errorMsg}</div>}

      {/* Metric Telemetry Cards Grid */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <span style={styles.metricTitle}>PACKETS / SEC</span>
          <span style={styles.metricValue}>{status?.packets_per_sec ?? 0}</span>
          <span style={styles.metricSubtext}>Live capture throughput</span>
        </div>

        <div style={styles.metricCard}>
          <span style={styles.metricTitle}>FLOWS / SEC</span>
          <span style={styles.metricValue}>{status?.flows_per_sec ?? 0}</span>
          <span style={styles.metricSubtext}>Completed flows emitted</span>
        </div>

        <div style={styles.metricCard}>
          <span style={styles.metricTitle}>ACTIVE FLOWS</span>
          <span style={styles.metricValue}>{status?.active_flows ?? 0}</span>
          <span style={styles.metricSubtext}>In-memory flow cache</span>
        </div>

        <div style={styles.metricCard}>
          <span style={styles.metricTitle}>BANDWIDTH</span>
          <span style={styles.metricValue}>{formatBandwidth(status?.bandwidth_bps ?? 0)}</span>
          <span style={styles.metricSubtext}>Ingress network rate</span>
        </div>

        <div style={styles.metricCard}>
          <span style={styles.metricTitle}>TOTAL PACKETS</span>
          <span style={styles.metricValue}>{status?.total_packets_captured ?? 0}</span>
          <span style={styles.metricSubtext}>Cumulative captured</span>
        </div>

        <div style={styles.metricCard}>
          <span style={styles.metricTitle}>TOTAL FLOWS</span>
          <span style={styles.metricValue}>{status?.total_flows_processed ?? 0}</span>
          <span style={styles.metricSubtext}>Pushed to Redis Stream</span>
        </div>

        <div style={styles.metricCard}>
          <span style={styles.metricTitle}>KNOWN ATTACKS</span>
          <span style={{ ...styles.metricValue, color: (status?.known_attacks_detected ?? 0) > 0 ? '#ef4444' : '#f0f6fc' }}>
            {status?.known_attacks_detected ?? 0}
          </span>
          <span style={styles.metricSubtext}>Stage 1 RandomForest</span>
        </div>

        <div style={styles.metricCard}>
          <span style={styles.metricTitle}>UNKNOWN / ZERO-DAY</span>
          <span style={{ ...styles.metricValue, color: (status?.unknown_attacks_detected ?? 0) > 0 ? '#a855f7' : '#f0f6fc' }}>
            {status?.unknown_attacks_detected ?? 0}
          </span>
          <span style={styles.metricSubtext}>Stage 2 Autoencoder</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    color: '#f0f6fc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '16px',
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statusBadgeGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    transition: 'all 0.3s ease',
  },
  statusText: {
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  subText: {
    fontSize: '12px',
    color: '#8b949e',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  selectWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    color: '#8b949e',
    fontWeight: 500,
  },
  select: {
    backgroundColor: '#161b22',
    color: '#f0f6fc',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '220px',
  },
  button: {
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#ef4444',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
  },
  metricCard: {
    backgroundColor: '#161b22',
    border: '1px solid #21262d',
    borderRadius: '6px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metricTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#8b949e',
    letterSpacing: '0.5px',
  },
  metricValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  metricSubtext: {
    fontSize: '10px',
    color: '#6e7681',
  },
}
