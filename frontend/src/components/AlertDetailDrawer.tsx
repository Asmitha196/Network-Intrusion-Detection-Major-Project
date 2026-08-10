import { useState, FC } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import type { Alert } from '../types'
import apiClient from '../api/client'
import { getNaturalLanguageExplanation } from '../utils/shapExplanations'

interface AlertDetailDrawerProps {
  alert: Alert | null
  onClose: () => void
  onAlertDeleted?: (alertId: string) => void
}

export const AlertDetailDrawer: FC<AlertDetailDrawerProps> = ({
  alert,
  onClose,
  onAlertDeleted,
}) => {
  const [deleting, setDeleting] = useState<boolean>(false)

  if (!alert) return null

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to soft-delete this alert?')) return
    setDeleting(true)
    try {
      await apiClient.delete(`/alerts/${alert.id}`)
      if (onAlertDeleted) {
        onAlertDeleted(alert.id)
      }
      onClose()
    } catch (e) {
      window.alert('Failed to delete alert: ' + e)
    } finally {
      setDeleting(false)
    }
  }

  // Format SHAP / Feature importances for chart display (Top 8 features)
  const shapData = (() => {
    if (!alert.shap_explanation) return []
    const names = alert.shap_explanation.feature_names || []
    const values = alert.shap_explanation.shap_values || []

    const pairs = names.map((name, idx) => ({
      feature: name.length > 22 ? name.substring(0, 20) + '...' : name,
      fullName: name,
      importance: Math.abs(values[idx] || 0),
      value: values[idx] || 0,
    }))

    // Sort by descending absolute importance & take top 8
    pairs.sort((a, b) => b.importance - a.importance)
    return pairs.slice(0, 8)
  })()

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Alert Details</h2>
            <span style={styles.subtitle}>ID: {alert.id}</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div style={styles.body}>
          {/* Key Metrics Grid */}
          <div style={styles.grid}>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Attack Classification</span>
              <span style={styles.metaValue}>{alert.attack_type || 'Anomaly (Zero-Day)'}</span>
            </div>

            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Detection Stage</span>
              <span style={styles.metaValue}>
                Stage {alert.stage} {alert.stage === 1 ? '(Classifier)' : '(Autoencoder)'}
              </span>
            </div>

            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Severity Level</span>
              <span style={{ ...styles.metaValue, color: alert.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>
                {alert.severity.toUpperCase()}
              </span>
            </div>

            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>ML Model Confidence</span>
              <span style={styles.metaValue}>{(alert.confidence * 100).toFixed(1)}%</span>
            </div>

            <div style={{ ...styles.metaItem, borderLeft: '3px solid #388bfd' }}>
              <span style={styles.metaLabel}>Security Risk Score (0-100)</span>
              <span style={{ ...styles.metaValue, color: '#58a6ff', fontWeight: 700 }}>
                {alert.risk_score !== undefined ? `${alert.risk_score}/100 (${alert.risk_level || 'MED'})` : `${Math.round(alert.confidence * 85)}/100`}
              </span>
            </div>
          </div>

          {/* Flow Metadata Section */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Flow Tuple Metadata</h4>
            <div style={styles.flowTupleGrid}>
              <div>
                <span style={styles.subLabel}>Source</span>
                <div style={styles.ipValue}>
                  {alert.src_ip || '192.168.10.50'}:{alert.src_port || 49152}
                </div>
              </div>
              <div>
                <span style={styles.subLabel}>Destination</span>
                <div style={styles.ipValue}>
                  {alert.dst_ip || '172.16.0.5'}:{alert.dst_port || 80}
                </div>
              </div>
              <div>
                <span style={styles.subLabel}>Protocol</span>
                <div style={styles.protoValue}>{alert.protocol || 'TCP'}</div>
              </div>
              <div>
                <span style={styles.subLabel}>Timestamp</span>
                <div style={styles.timeValue}>{alert.timestamp}</div>
              </div>
            </div>
          </div>

          {/* WHY WAS THIS ALERT GENERATED? */}
          <div style={{ ...styles.section, backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f0f6fc', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔍 WHY WAS THIS ALERT GENERATED?
            </h3>

            {shapData.length === 0 ? (
              <div style={styles.noShapText}>SHAP feature values unavailable for this flow record.</div>
            ) : (
              <div>
                {/* Top Contributing Feature Impact Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {shapData.slice(0, 5).map((item, idx) => {
                    const maxVal = shapData[0]?.importance || 1;
                    const pct = Math.min(100, Math.max(10, (item.importance / maxVal) * 100));
                    const valStr = item.value >= 0 ? `+${item.value.toFixed(2)}` : `${item.value.toFixed(2)}`;

                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: '#c9d1d9' }}>{item.fullName}</span>
                          <span style={{ color: idx < 2 ? '#ff7b72' : '#ffa657', fontFamily: 'monospace' }}>{valStr}</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: '#21262d', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              backgroundColor: idx === 0 ? '#ff7b72' : idx === 1 ? '#ffa657' : '#58a6ff',
                              borderRadius: '4px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Natural Language Explanations Box */}
                <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '12px' }}>
                  <h5 style={{ fontSize: '11px', fontWeight: 700, color: '#8b949e', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    PLAIN-ENGLISH THREAT DRIVERS:
                  </h5>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#c9d1d9', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {shapData.slice(0, 4).map((item, idx) => (
                      <li key={idx}>
                        <strong>{item.fullName}</strong>: {getNaturalLanguageExplanation(item.fullName)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Feature Importance / SHAP Explanation Chart */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Feature Importance Breakdown (SHAP)</h4>
            <span style={styles.sectionSubtitle}>
              Top network features driving model classification
            </span>

            <div style={styles.chartWrapper}>
              {shapData.length === 0 ? (
                <div style={styles.noShapText}>No SHAP feature importances attached.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={shapData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <XAxis type="number" stroke="#8b949e" fontSize={10} />
                    <YAxis dataKey="feature" type="category" stroke="#8b949e" fontSize={10} width={130} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161b22',
                        borderColor: '#30363d',
                        color: '#f0f6fc',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="importance" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      {shapData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Raw Feature Snapshot JSON */}
          {alert.raw_features && (
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>Raw Flow Features Snapshot</h4>
              <pre style={styles.jsonBox}>
                {JSON.stringify(alert.raw_features, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div style={styles.footer}>
          <button style={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Soft Delete Alert'}
          </button>
          <button style={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(3px)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  drawer: {
    width: '520px',
    maxWidth: '90vw',
    height: '100%',
    backgroundColor: '#0d1117',
    borderLeft: '1px solid #30363d',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.5)',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #21262d',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  subtitle: {
    fontSize: '11px',
    color: '#8b949e',
    fontFamily: 'monospace',
  },
  closeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8b949e',
    fontSize: '18px',
    cursor: 'pointer',
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    backgroundColor: '#161b22',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #21262d',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metaLabel: {
    fontSize: '11px',
    color: '#8b949e',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  sectionSubtitle: {
    fontSize: '11px',
    color: '#8b949e',
  },
  flowTupleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    backgroundColor: '#161b22',
    padding: '14px',
    borderRadius: '6px',
    border: '1px solid #21262d',
  },
  subLabel: {
    fontSize: '10px',
    color: '#8b949e',
    textTransform: 'uppercase',
  },
  ipValue: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#58a6ff',
    fontWeight: 600,
  },
  protoValue: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#a855f7',
    fontWeight: 600,
  },
  timeValue: {
    fontSize: '11px',
    color: '#c9d1d9',
  },
  chartWrapper: {
    backgroundColor: '#161b22',
    borderRadius: '6px',
    padding: '12px 8px',
    border: '1px solid #21262d',
  },
  noShapText: {
    fontSize: '12px',
    color: '#6e7681',
    textAlign: 'center',
    padding: '20px',
  },
  jsonBox: {
    backgroundColor: '#161b22',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #21262d',
    color: '#79c0ff',
    fontSize: '11px',
    fontFamily: 'monospace',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #21262d',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    border: '1px solid #ef4444',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    backgroundColor: '#21262d',
    color: '#c9d1d9',
    border: '1px solid #30363d',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
}

export default AlertDetailDrawer
