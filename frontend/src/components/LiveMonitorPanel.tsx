import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Wifi, AlertTriangle } from 'lucide-react'
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
    <div
      className="rounded-xl p-4 md:p-5 relative overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: isActive ? '0 0 20px rgba(0, 242, 254, 0.06)' : 'none',
      }}
    >
      {/* Top Accent Stripe */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: isActive
            ? 'linear-gradient(90deg, #10b981 0%, #00f2fe 50%, #10b981 100%)'
            : 'linear-gradient(90deg, transparent, var(--border), transparent)',
        }}
      />

      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: isActive ? 'var(--low-dim)' : 'var(--surface-2)',
              border: `1px solid ${isActive ? 'var(--low-border)' : 'var(--border)'}`,
            }}
          >
            <Wifi size={16} style={{ color: isActive ? 'var(--low)' : 'var(--tx-4)' }} />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: isActive ? '#10b981' : '#5b6880',
                  boxShadow: isActive ? '0 0 10px #10b981' : 'none',
                  animation: isActive ? 'blink-dot 1.5s ease-in-out infinite' : 'none',
                }}
              />
              <span className="text-[13px] font-mono font-bold tracking-wider uppercase" style={{ color: isActive ? 'var(--low)' : 'var(--tx-3)' }}>
                {isActive ? 'Live Packet Ingestion Active' : 'Live Packet Ingestion Paused'}
              </span>
            </div>
            <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--tx-4)' }}>
              Npcap Layer 2/3 packet streaming → FlowBuilder → Redis Stream → Stage 1 & 2 ML Detection
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--tx-4)' }}>
              NIC:
            </span>
            <select
              className="text-[12px] font-mono px-3 py-1.5 rounded-lg outline-none cursor-pointer transition-colors"
              style={{
                backgroundColor: 'var(--surface-2)',
                color: 'var(--tx-1)',
                border: '1px solid var(--border)',
                minWidth: '220px',
              }}
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
              type="button"
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-mono font-bold uppercase tracking-wider transition-all duration-150 shadow-md cursor-pointer select-none"
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: '1px solid #ef4444',
                boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)',
              }}
              onClick={handleStop}
              disabled={loading}
            >
              <Square size={13} fill="#ffffff" />
              <span>{loading ? 'Stopping...' : 'Stop Capture'}</span>
            </button>
          ) : (
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-mono font-bold uppercase tracking-wider transition-all duration-150 shadow-md cursor-pointer select-none"
              style={{
                backgroundColor: '#10b981',
                color: '#090d16',
                border: '1px solid #34d399',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)',
              }}
              onClick={handleStart}
              disabled={loading}
            >
              <Play size={13} fill="#090d16" />
              <span>{loading ? 'Starting...' : 'Start Capture'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div
          className="flex items-center gap-2.5 p-3 rounded-lg text-[12px] font-mono mb-4"
          style={{
            backgroundColor: 'var(--crit-dim)',
            border: '1px solid var(--crit-border)',
            color: 'var(--crit)',
          }}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metric Telemetry Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {[
          { label: 'PACKETS / SEC', value: status?.packets_per_sec ?? 0, sub: 'Real-time ingress', col: 'var(--tx-1)' },
          { label: 'FLOWS / SEC', value: status?.flows_per_sec ?? 0, sub: 'Completed flows', col: 'var(--tx-1)' },
          { label: 'ACTIVE FLOWS', value: status?.active_flows ?? 0, sub: 'In-memory cache', col: 'var(--accent)' },
          { label: 'BANDWIDTH', value: formatBandwidth(status?.bandwidth_bps ?? 0), sub: 'Throughput rate', col: 'var(--accent)' },
          { label: 'TOTAL PACKETS', value: (status?.total_packets_captured ?? 0).toLocaleString(), sub: 'Hardware NIC', col: 'var(--tx-1)' },
          { label: 'TOTAL FLOWS', value: (status?.total_flows_processed ?? 0).toLocaleString(), sub: 'Redis stream', col: 'var(--tx-1)' },
          {
            label: 'KNOWN ATTACKS',
            value: status?.known_attacks_detected ?? 0,
            sub: 'Stage 1 RF',
            col: (status?.known_attacks_detected ?? 0) > 0 ? 'var(--crit)' : 'var(--tx-1)',
            alert: (status?.known_attacks_detected ?? 0) > 0,
          },
          {
            label: 'ZERO-DAY ANOMALY',
            value: status?.unknown_attacks_detected ?? 0,
            sub: 'Stage 2 AE',
            col: (status?.unknown_attacks_detected ?? 0) > 0 ? '#a855f7' : 'var(--tx-1)',
            alert: (status?.unknown_attacks_detected ?? 0) > 0,
          },
        ].map((item, idx) => (
          <div
            key={idx}
            className="rounded-lg p-2.5 flex flex-col justify-between transition-colors"
            style={{
              backgroundColor: 'var(--surface-2)',
              border: item.alert ? '1px solid var(--crit-border)' : '1px solid var(--border)',
            }}
          >
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-ellipsis overflow-hidden whitespace-nowrap" style={{ color: 'var(--tx-4)' }}>
              {item.label}
            </span>
            <span className="text-[17px] font-mono font-bold my-1 tracking-tight" style={{ color: item.col }}>
              {item.value}
            </span>
            <span className="text-[9.5px] font-mono" style={{ color: 'var(--tx-5)' }}>
              {item.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

