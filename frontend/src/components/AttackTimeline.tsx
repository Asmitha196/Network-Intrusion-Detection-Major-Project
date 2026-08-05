import React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { TimelineItem } from '../types'

interface AttackTimelineProps {
  timeline: TimelineItem[]
  interval: string
  onIntervalChange: (newInterval: string) => void
}

export const AttackTimeline: React.FC<AttackTimelineProps> = ({
  timeline,
  interval,
  onIntervalChange,
}) => {
  const formattedData = timeline.map((item) => {
    let label = item.timestamp
    try {
      const d = new Date(item.timestamp)
      label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      label = item.timestamp
    }
    return {
      ...item,
      timeLabel: label,
    }
  })

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.title}>Attack Timeline</h3>
          <span style={styles.subtitle}>Aggregated alert volumes over time (TimescaleDB time_bucket)</span>
        </div>

        <div style={styles.controls}>
          {['1m', '5m', '1h', '1d'].map((i) => (
            <button
              key={i}
              style={{
                ...styles.btn,
                backgroundColor: interval === i ? '#3b82f6' : '#161b22',
                color: interval === i ? '#ffffff' : '#8b949e',
                borderColor: interval === i ? '#3b82f6' : '#30363d',
              }}
              onClick={() => onIntervalChange(i)}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.chartContainer}>
        {formattedData.length === 0 ? (
          <div style={styles.emptyState}>No time-series alert data recorded for the selected window.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={formattedData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="timeLabel" stroke="#8b949e" fontSize={11} tickLine={false} />
              <YAxis stroke="#8b949e" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  borderColor: '#30363d',
                  borderRadius: '6px',
                  color: '#f0f6fc',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fillOpacity={1} fill="url(#colorCritical)" name="Critical" />
              <Area type="monotone" dataKey="high" stackId="1" stroke="#f97316" fillOpacity={1} fill="url(#colorHigh)" name="High" />
              <Area type="monotone" dataKey="medium" stackId="1" stroke="#f59e0b" fillOpacity={1} fill="url(#colorMedium)" name="Medium" />
              <Area type="monotone" dataKey="low" stackId="1" stroke="#10b981" fillOpacity={1} fill="url(#colorLow)" name="Low" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '16px 20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  subtitle: {
    fontSize: '12px',
    color: '#8b949e',
  },
  controls: {
    display: 'flex',
    gap: '4px',
  },
  btn: {
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 600,
    borderRadius: '4px',
    border: '1px solid #30363d',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  chartContainer: {
    width: '100%',
    minHeight: '260px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    color: '#6e7681',
    fontSize: '13px',
    padding: '40px',
    textAlign: 'center',
  },
}

export default AttackTimeline
