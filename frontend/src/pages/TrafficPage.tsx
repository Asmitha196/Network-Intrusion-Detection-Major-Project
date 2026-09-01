import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'
import apiClient from '../api/client'
import { StatCard, Panel, SectionHeader, IP, Table, Tr, Td, EmptyState } from '../components/ui'
import type { MetricsOverview, TrafficStats, WebSocketMessage } from '../types'

interface ActiveHostItem {
  ip: string
  type: string
  status: string
}

export default function TrafficPage() {
  const { lastMessage, readyState } = useWebSocket<WebSocketMessage>('/ws/traffic')
  const [overview, setOverview] = useState<MetricsOverview | null>(null)
  const [hosts, setHosts] = useState<ActiveHostItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const trafficStats =
    lastMessage && typeof lastMessage === 'object' && 'type' in lastMessage && lastMessage.type === 'traffic_stats'
      ? (lastMessage as TrafficStats)
      : null

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const [overviewRes, analyticsRes] = await Promise.allSettled([
        apiClient.get<MetricsOverview>('/metrics/overview'),
        apiClient.get<any>('/analytics'),
      ])

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data)
      }

      if (analyticsRes.status === 'fulfilled') {
        const data = analyticsRes.value.data
        const hostList: ActiveHostItem[] = []

        if (Array.isArray(data?.top_sources)) {
          data.top_sources.forEach((s: any) => {
            if (s.ip && !hostList.some(h => h.ip === s.ip)) {
              hostList.push({
                ip: s.ip,
                type: s.country || (s.ip.startsWith('192.168.') || s.ip.startsWith('10.') || s.ip.startsWith('172.16.') ? 'Internal LAN Host' : 'External Threat Source'),
                status: 'Active',
              })
            }
          })
        }

        if (Array.isArray(data?.top_destinations)) {
          data.top_destinations.forEach((d: any) => {
            if (d.ip && !hostList.some(h => h.ip === d.ip)) {
              hostList.push({
                ip: d.ip,
                type: d.label || 'Target Gateway',
                status: 'Active',
              })
            }
          })
        }

        setHosts(hostList)
      }
    } catch (e) {
      console.warn('Failed to fetch live traffic metrics:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const timer = setInterval(fetchMetrics, 5000)
    return () => clearInterval(timer)
  }, [])

  const protocols = overview?.protocols || [
    { protocol: 'TCP', count: 0 },
    { protocol: 'UDP', count: 0 },
  ]

  const totalProcessed = (trafficStats?.total_flows_processed && trafficStats.total_flows_processed > 0)
    ? trafficStats.total_flows_processed
    : (overview?.total_flows ?? overview?.total_alerts ?? 0)
  const activeAlerts = trafficStats?.total_alerts_generated ?? overview?.today_alerts ?? 0
  const isStreaming = readyState === 'open' || (trafficStats !== null)

  return (
    <div className="space-y-4 select-none">
      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Processed Flow Records"
          value={totalProcessed ? totalProcessed.toLocaleString() : 'N/A'}
          sub="Total database flow entries"
          accent
        />
        <StatCard
          label="Threat Detections"
          value={activeAlerts}
          sub="Stage 1 & 2 alerts generated"
          critical={activeAlerts > 0}
        />
        <StatCard
          label="Stream Status"
          value={isStreaming ? 'LIVE' : 'DISCONNECTED'}
          sub="WebSocket /ws/traffic"
          accent={isStreaming}
        />
      </div>

      {/* ── PROTOCOL DISTRIBUTION & ACTIVE HOSTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Protocol Distribution */}
        <Panel>
          <SectionHeader title="Protocol Distribution" sub="Layer 4 transport classification">
            <button
              onClick={fetchMetrics}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </SectionHeader>

          <div className="space-y-3.5">
            {protocols.map((proto) => {
              const count = proto.count ?? 0
              const maxCount = Math.max(...protocols.map(p => p.count ?? 0), 1)
              const pct = Number(((count / maxCount) * 100).toFixed(0))
              const isTcp = proto.protocol.toUpperCase() === 'TCP'
              const col = isTcp ? 'var(--accent)' : '#3b82f6'

              return (
                <div key={proto.protocol}>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="font-bold" style={{ color: 'var(--tx-2)' }}>{proto.protocol}</span>
                    <span style={{ color: col }}>{count.toLocaleString()} flows</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(pct, count > 0 ? 5 : 0)}%`,
                        backgroundColor: col,
                        boxShadow: `0 0 6px ${col}66`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Active Network Hosts */}
        <Panel>
          <SectionHeader title="Active Network Hosts" sub="Real-time traffic origin & destination entities" />

          {hosts.length > 0 ? (
            <Table headers={['Host IP', 'Classification', 'Status']}>
              {hosts.map((host) => (
                <Tr key={host.ip}>
                  <Td><IP>{host.ip}</IP></Td>
                  <Td muted>{host.type}</Td>
                  <Td>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold"
                      style={{ background: 'var(--low-dim)', border: '1px solid var(--low-border)', color: 'var(--low)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--low)' }} />
                      {host.status}
                    </span>
                  </Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <EmptyState message="Awaiting live host traffic telemetry" />
          )}
        </Panel>
      </div>
    </div>
  )
}

