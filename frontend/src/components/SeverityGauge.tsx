import type { Alert } from '../types'
import {
  RadialBarChart,
  RadialBar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface Props {
  alerts: Alert[]
}

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'] as const
const SEVERITY_FILL: Record<string, string> = {
  low:      '#6ee7b7',
  medium:   '#fde68a',
  high:     '#fb923c',
  critical: '#f87171',
}

/**
 * SeverityGauge — RadialBarChart showing the distribution of alert severities.
 *
 * Each severity level (low / medium / high / critical) is rendered as a
 * concentric arc whose length represents the count of alerts at that level.
 *
 * TODO:
 *   - Add an animated transition as new alerts arrive
 *   - Show percentage labels on the arcs (use <LabelList> or custom label)
 *   - Link each arc to a filtered alert list on click
 */
export default function SeverityGauge({ alerts }: Props) {
  // Count alerts per severity
  const counts = SEVERITY_ORDER.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {}
  )
  for (const alert of alerts) {
    counts[alert.severity] = (counts[alert.severity] ?? 0) + 1
  }

  const data = SEVERITY_ORDER.map((severity) => ({
    name: severity.charAt(0).toUpperCase() + severity.slice(1),
    value: counts[severity],
    fill: SEVERITY_FILL[severity],
  }))

  const total = alerts.length

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Severity Distribution</h2>
      {total === 0 ? (
        <p style={styles.muted}>No alerts yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="20%"
            outerRadius="90%"
            barSize={16}
            data={data}
          >
            <RadialBar
              label={{ position: 'insideStart', fill: '#0f1117', fontSize: 10 }}
              dataKey="value"
            />
            <Legend
              iconSize={10}
              layout="horizontal"
              verticalAlign="bottom"
              formatter={(value) => (
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>
              )}
            />
            <Tooltip
              contentStyle={{ background: '#1e2230', border: '1px solid #2d3448', fontSize: 12 }}
              formatter={(value: number, name: string) => [
                `${value} (${((value / total) * 100).toFixed(0)}%)`,
                name,
              ]}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1e2230',
    borderRadius: 8,
    padding: '16px',
    border: '1px solid #2d3448',
  },
  heading: {
    fontSize: 14,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 12,
  },
  muted: { color: '#64748b', fontSize: 13 },
}
