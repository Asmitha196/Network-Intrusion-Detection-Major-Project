import { useState, useEffect } from 'react'
import AttackTimeline from '../components/AttackTimeline'
import AttackDistribution from '../components/AttackDistribution'
import apiClient from '../api/client'
import { StatCard, Panel, SectionHeader } from '../components/ui'
import type { MetricsOverview, TimelineItem, TimelineResponse } from '../types'

export default function MetricsPage() {
  const [overview, setOverview] = useState<MetricsOverview | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [interval, setInterval] = useState<string>('5m')

  useEffect(() => {
    async function fetchData() {
      try {
        const now = new Date()
        let hoursAgo = 24
        if (interval === '1h') hoursAgo = 24 * 7
        if (interval === '1d') hoursAgo = 24 * 30

        const startTs = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString()

        const [overviewRes, timelineRes] = await Promise.allSettled([
          apiClient.get<MetricsOverview>('/metrics/overview'),
          apiClient.get<TimelineResponse>(`/metrics/timeline?start_ts=${encodeURIComponent(startTs)}&interval=${interval}`),
        ])

        if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data)
        if (timelineRes.status === 'fulfilled') setTimeline(timelineRes.value.data.timeline || [])
      } catch (e) {
        console.warn('Failed to fetch metrics:', e)
      }
    }
    fetchData()
  }, [interval])

  return (
    <div className="space-y-4 select-none">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Today's Incidents" value={overview?.today_alerts ?? 0} sub="24-hour total events" accent />
        <StatCard label="Critical Threats"  value={overview?.critical_alerts ?? 0} sub="High priority alerts" critical={(overview?.critical_alerts ?? 0) > 0} />
        <StatCard label="High Threats"      value={overview?.high_alerts ?? 0}     sub="Elevated risk alerts" />
        <StatCard label="Medium Threats"    value={overview?.medium_alerts ?? 0}   sub="Triage tier alerts" />
      </div>

      {/* Main Charts */}
      <div className="w-full">
        <AttackTimeline
          timeline={timeline}
          interval={interval}
          onIntervalChange={(newInterval) => setInterval(newInterval)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttackDistribution overview={overview} />

        <Panel>
          <SectionHeader title="Benign vs Malicious Flow Ratio" sub="Ingress classification split" />
          <div className="flex items-center justify-around py-8">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--tx-4)' }}>Benign Flows</span>
              <span className="text-3xl font-mono font-bold" style={{ color: 'var(--low)' }}>
                {overview?.benign_vs_malicious?.benign?.toLocaleString() ?? 0}
              </span>
            </div>

            <div className="h-12 w-px" style={{ background: 'var(--border)' }} />

            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--tx-4)' }}>Malicious Threats</span>
              <span className="text-3xl font-mono font-bold" style={{ color: 'var(--crit)' }}>
                {overview?.benign_vs_malicious?.malicious?.toLocaleString() ?? 0}
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

