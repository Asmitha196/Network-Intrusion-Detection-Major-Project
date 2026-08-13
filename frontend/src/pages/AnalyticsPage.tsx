import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip,
} from 'recharts'
import { RefreshCw, TrendingUp } from 'lucide-react'
import apiClient from '../api/client'
import { StatCard, SectionHeader, Panel, IP, LoadingState, EmptyState } from '../components/ui'

type TimeWindow = '1h' | '24h' | '7d' | '30d'

const TIME_WINDOWS: Array<{ key: TimeWindow; label: string }> = [
  { key: '1h', label: '1 Hour' },
  { key: '24h', label: '24 Hours' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
]

interface AnalyticsData {
  window: TimeWindow
  summary: {
    total_alerts: number
    known_attacks: number
    zero_day_anomalies: number
    benign_flows: number
  }
  top_attacks: Array<{ attack_type: string; count: number }>
  protocols: Array<{ protocol: string; count: number }>
  top_ports: Array<{ port: number; count: number }>
  top_sources: Array<{ ip: string; country: string; count: number; threat_level?: string }>
  top_destinations: Array<{ ip: string; label?: string; count: number }>
  timeline: Array<{ timestamp: string; known_attacks: number; zero_day_anomalies: number; total_alerts: number }>
}

const axisProps = { fill: 'var(--tx-5)', fontSize: 10, fontFamily: 'JetBrains Mono' } as const
const PROTOCOL_COLORS: Record<string, string> = {
  TCP: '#00f2fe',
  UDP: '#3b82f6',
  ICMP: '#f59e0b',
  OTHER: '#8892a4',
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
      <p className="text-[10px] font-mono mb-2" style={{ color: 'var(--tx-4)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey || p.name} className="text-[11px] font-mono" style={{ color: p.color || p.fill }}>
          {p.name ?? p.dataKey}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [windowKey, setWindowKey] = useState<TimeWindow>('24h')
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get<AnalyticsData>('/analytics', {
        params: { window: windowKey }
      })
      setAnalytics(res.data)
    } catch (err) {
      console.error(`Failed to fetch analytics for window ${windowKey}:`, err)
    } finally {
      setLoading(false)
    }
  }, [windowKey])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Protocol pie chart data calculation
  const protocolData = useMemo(() => {
    if (!analytics?.protocols || analytics.protocols.length === 0) return []
    const total = analytics.protocols.reduce((acc, p) => acc + p.count, 0) || 1
    return analytics.protocols.map(p => {
      const name = String(p.protocol).toUpperCase()
      return {
        name,
        value: Number(((p.count / total) * 100).toFixed(1)),
        count: p.count,
        fill: PROTOCOL_COLORS[name] || PROTOCOL_COLORS.OTHER,
      }
    })
  }, [analytics])

  // Process timeline for Recharts AreaChart
  const timelineChartData = useMemo(() => {
    if (!analytics?.timeline || analytics.timeline.length === 0) return []
    return analytics.timeline.map(t => {
      const timeLabel = t.timestamp ? t.timestamp.replace('T', ' ').slice(11, 16) : ''
      return {
        time: timeLabel,
        known: t.known_attacks ?? 0,
        zeroDay: t.zero_day_anomalies ?? 0,
        total: t.total_alerts ?? 0,
      }
    })
  }, [analytics])

  return (
    <div className="space-y-5 select-none">

      {/* ── TIMEFRAME SELECTOR BUTTONS ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {TIME_WINDOWS.map(w => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all"
              style={windowKey === w.key
                ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }
                : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx-4)' }
              }
            >
              {w.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchAnalytics}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── SUMMARY STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Window Alerts"  value={analytics?.summary?.total_alerts?.toLocaleString() ?? 'N/A'} sub={`Timeframe: ${windowKey}`} accent />
        <StatCard label="Stage 1 Known Attacks" value={analytics?.summary?.known_attacks?.toLocaleString() ?? 'N/A'} sub="Supervised classifier" />
        <StatCard label="Stage 2 Zero-Day"    value={analytics?.summary?.zero_day_anomalies?.toLocaleString() ?? 'N/A'} sub="Autoencoder anomalies" critical={(analytics?.summary?.zero_day_anomalies ?? 0) > 0} />
        <StatCard label="Benign Network Flows"  value={analytics?.summary?.benign_flows?.toLocaleString() ?? 'N/A'} sub="Processed baseline" />
      </div>

      {loading && !analytics ? (
        <LoadingState />
      ) : (
        <>
          {/* ── TOP CHARTS ROW ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Attack Types Bar Chart */}
            <Panel>
              <SectionHeader title="Top Attack Types" sub={`Frequency breakdown for ${windowKey} window`} />
              {analytics?.top_attacks && analytics.top_attacks.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.top_attacks} layout="vertical" margin={{ left: 30 }}>
                    <XAxis type="number" tick={axisProps} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="attack_type" tick={axisProps} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="count" name="Alert Count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No attack type metrics available for this timeframe" />
              )}
            </Panel>

            {/* Protocol Distribution Pie Chart */}
            <Panel>
              <SectionHeader title="Protocol Distribution" sub="Traffic composition (TCP / UDP / ICMP)" />
              {protocolData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie data={protocolData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3}>
                        {protocolData.map((e, i) => <Cell key={i} fill={e.fill} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<Tip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-5 mt-2">
                    {protocolData.map(d => (
                      <span key={d.name} className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: 'var(--tx-4)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                        {d.name} ({d.value}%)
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState message="No protocol breakdown data available" />
              )}
            </Panel>
          </div>

          {/* ── TOP SOURCES & DESTINATIONS ROW ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Top Source IPs */}
            <Panel>
              <SectionHeader title="Top Source Threat IPs" sub="Highest alert volume generators" />
              {analytics?.top_sources && analytics.top_sources.length > 0 ? (
                <div className="space-y-3 mt-1">
                  {analytics.top_sources.map((s, i) => {
                    const maxCnt = Math.max(...analytics.top_sources.map(x => x.count), 1)
                    return (
                      <div key={s.ip} className="flex items-center gap-2 text-xs font-mono">
                        <span className="w-4" style={{ color: 'var(--tx-5)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <IP>{s.ip}</IP>
                          <p className="text-[10px]" style={{ color: 'var(--tx-5)' }}>{s.country || 'Unknown'}</p>
                        </div>
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(s.count / maxCnt) * 100}%`, background: 'var(--crit)' }} />
                        </div>
                        <span className="w-10 text-right font-semibold" style={{ color: 'var(--tx-1)' }}>{s.count}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState message="No source threat IPs logged" />
              )}
            </Panel>

            {/* Top Destination Hosts */}
            <Panel>
              <SectionHeader title="Top Destination Targets" sub="Targeted internal assets" />
              {analytics?.top_destinations && analytics.top_destinations.length > 0 ? (
                <div className="space-y-3 mt-1">
                  {analytics.top_destinations.map((d, i) => {
                    const maxCnt = Math.max(...analytics.top_destinations.map(x => x.count), 1)
                    return (
                      <div key={d.ip} className="flex items-center gap-2 text-xs font-mono">
                        <span className="w-4" style={{ color: 'var(--tx-5)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <span style={{ color: 'var(--tx-2)' }}>{d.ip}</span>
                          <p className="text-[10px]" style={{ color: 'var(--tx-5)' }}>{d.label || 'Target Asset'}</p>
                        </div>
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(d.count / maxCnt) * 100}%`, background: 'var(--accent)' }} />
                        </div>
                        <span className="w-10 text-right font-semibold" style={{ color: 'var(--tx-1)' }}>{d.count}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState message="No destination target hosts logged" />
              )}
            </Panel>

            {/* Top Destination Ports */}
            <Panel>
              <SectionHeader title="Top Targeted Ports" sub="Most probed destination ports" />
              {analytics?.top_ports && analytics.top_ports.length > 0 ? (
                <div className="space-y-3 mt-1">
                  {analytics.top_ports.map((p, i) => {
                    const maxCnt = Math.max(...analytics.top_ports.map(x => x.count), 1)
                    return (
                      <div key={p.port} className="flex items-center gap-2 text-xs font-mono">
                        <span className="w-4" style={{ color: 'var(--tx-5)' }}>{i + 1}</span>
                        <span className="w-14 font-bold" style={{ color: 'var(--accent)' }}>Port {p.port}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(p.count / maxCnt) * 100}%`, background: '#8b5cf6' }} />
                        </div>
                        <span className="w-10 text-right font-semibold" style={{ color: 'var(--tx-1)' }}>{p.count}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState message="No port telemetry logged" />
              )}
            </Panel>
          </div>

          {/* ── SEVERITY & TIMELINE TREND ── */}
          {timelineChartData.length > 0 && (
            <Panel>
              <SectionHeader title="Alert & Threat Timeline Trend" sub={`Known attack vs zero-day anomaly volume — ${windowKey}`}>
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={12} style={{ color: 'var(--accent)' }} />
                  <span className="text-[10px] font-mono" style={{ color: 'var(--tx-5)' }}>{analytics?.summary?.total_alerts} Total Alerts</span>
                </div>
              </SectionHeader>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={timelineChartData}>
                  <defs>
                    <linearGradient id="knownGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00f2fe" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#00f2fe" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="zeroDayGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={axisProps} />
                  <YAxis axisLine={false} tickLine={false} tick={axisProps} />
                  <Tooltip content={<Tip />} />
                  <Area type="monotone" dataKey="known" name="Stage 1 Known Attacks" stroke="var(--accent)" fill="url(#knownGrad)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="zeroDay" name="Stage 2 Zero-Day Anomalies" stroke="var(--crit)" fill="url(#zeroDayGrad)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}
