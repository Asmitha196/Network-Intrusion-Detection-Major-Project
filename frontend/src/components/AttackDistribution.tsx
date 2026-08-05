import { FC } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import type { MetricsOverview } from '../types'

interface AttackDistributionProps {
  overview: MetricsOverview | null
}

const COLORS = ['#ef4444', '#f97316', '#a855f7', '#3b82f6', '#10b981', '#64748b']

export const AttackDistribution: FC<AttackDistributionProps> = ({ overview }) => {
  const topAttacks = overview?.top_attacks ?? []

  const data = topAttacks.map((item) => ({
    name: item.attack_type || 'Anomaly (Stage 2)',
    value: item.count,
  }))

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.title}>Attack Distribution</h3>
        <span style={styles.subtitle}>Threat classification breakdown</span>
      </div>

      <div style={styles.chartContainer}>
        {data.length === 0 ? (
          <div style={styles.emptyState}>No attack classifications available.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  borderColor: '#30363d',
                  borderRadius: '6px',
                  color: '#f0f6fc',
                  fontSize: '12px',
                }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              />
            </PieChart>
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
    marginBottom: '16px',
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

export default AttackDistribution
