import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, ChevronUp, ChevronDown, Trash2, Search, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import apiClient from '../api/client'
import { SeverityBadge, Panel, SectionHeader, IP, Table, Tr, Td, EmptyState, LoadingState, Severity } from '../components/ui'
import { useWebSocket } from '../hooks/useWebSocket'
import type { Alert, AlertListResponse, ShapExplanation, WebSocketMessage } from '../types'

const SEVERITY_MAP: Record<string, Severity> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
}

interface ProcessedShapFeature {
  feature: string
  value: number
  impact: number
  direction: 'up' | 'down'
}

function extractShapFeatures(shap?: ShapExplanation | null): ProcessedShapFeature[] {
  if (!shap || !shap.feature_names || !shap.shap_values || shap.feature_names.length === 0) {
    return []
  }

  const maxVal = Math.max(...shap.shap_values.map(v => Math.abs(v)), 0.0001)

  return shap.feature_names.map((name, i) => {
    const val = shap.shap_values[i] ?? 0
    return {
      feature: name,
      value: val,
      impact: Math.min(Math.abs(val) / maxVal, 1),
      direction: (val >= 0 ? 'up' : 'down') as 'up' | 'down',
    }
  }).sort((a, b) => b.impact - a.impact).slice(0, 8)
}

function AlertDrawer({ alertId, onClose, onDelete }: { alertId: string; onClose: () => void; onDelete: (id: string) => void }) {
  const [alert, setAlert] = useState<Alert | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [deleting, setDeleting] = useState<boolean>(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    apiClient.get<Alert>(`/alerts/${alertId}`)
      .then(res => {
        if (isMounted) setAlert(res.data)
      })
      .catch(err => {
        console.error(`Failed to fetch detail for alert ${alertId}:`, err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [alertId])

  const shapFeatures = useMemo(() => extractShapFeatures(alert?.shap_explanation), [alert?.shap_explanation])
  const severityUpper = SEVERITY_MAP[alert?.severity || 'low'] ?? 'LOW'

  const handleDelete = async () => {
    if (!alert) return
    if (!window.confirm(`Are you sure you want to delete alert ${alert.id}?`)) return

    try {
      setDeleting(true)
      await apiClient.delete(`/alerts/${alert.id}`)
      onDelete(alert.id)
      onClose()
    } catch (err) {
      console.error(`Failed to delete alert ${alert.id}:`, err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex select-none">
      <div className="flex-1" style={{ background: 'rgba(6,9,14,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <aside className="w-full max-w-md overflow-y-auto slide-in"
        style={{ background: 'var(--surface-2)', borderLeft: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: 'var(--tx-5)' }}>Alert Detail</p>
            <h3 className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>{alertId}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded transition-colors"
              title="Delete Alert"
              style={{ color: 'var(--crit)' }}
            >
              <Trash2 size={15} />
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--tx-4)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : alert ? (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Timestamp', alert.timestamp ? alert.timestamp.replace('T', ' ').replace('Z', ' UTC').slice(0, 19) : 'N/A'],
                ['Stage', `Stage ${alert.stage}`],
                ['Attack Type', alert.attack_type || (alert.stage === 2 ? 'Anomaly (Stage 2)' : 'Unknown')],
                ['Protocol', alert.protocol || 'N/A'],
                ['Confidence', typeof alert.confidence === 'number' ? `${(alert.confidence * 100).toFixed(1)}%` : 'N/A'],
                ['Reconstruction Err', alert.reconstruction_error ? alert.reconstruction_error.toFixed(4) : 'N/A'],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--tx-5)' }}>{k}</p>
                  <p className="text-[12px] font-mono font-medium" style={{ color: 'var(--tx-1)' }}>{v}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--tx-5)' }}>Source IP & Port</p>
                <IP>{alert.src_ip || 'N/A'}</IP>
                {alert.src_port && <span className="text-[11px] font-mono ml-1" style={{ color: 'var(--tx-4)' }}>:{alert.src_port}</span>}
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--tx-5)' }}>Dest IP & Port</p>
                <p className="text-[12px] font-mono" style={{ color: 'var(--tx-2)' }}>{alert.dst_ip || 'N/A'}</p>
                {alert.dst_port && <span className="text-[11px] font-mono ml-1" style={{ color: 'var(--tx-4)' }}>:{alert.dst_port}</span>}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--tx-5)' }}>Severity</p>
              <SeverityBadge severity={severityUpper} />
            </div>

            {/* REAL SHAP DATA VISUALIZATION */}
            {shapFeatures.length > 0 ? (
              <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--tx-5)' }}>
                    SHAP — Feature Importance ({alert.shap_explanation?.explanation_type || 'Real Model'})
                  </p>
                </div>
                <p className="text-[11px] font-mono leading-relaxed mb-4" style={{ color: 'var(--tx-4)' }}>
                  Feature contributions to model classification decision.
                </p>
                <div className="space-y-3">
                  {shapFeatures.map(f => (
                    <div key={f.feature}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono" style={{ color: 'var(--tx-2)' }}>{f.feature}</span>
                          {f.direction === 'up'
                            ? <ChevronUp size={12} style={{ color: 'var(--crit)' }} />
                            : <ChevronDown size={12} style={{ color: 'var(--low)' }} />
                          }
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--tx-4)' }}>{f.value.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full"
                            style={{
                              width: `${(f.impact * 100).toFixed(0)}%`,
                              background: f.direction === 'up' ? 'var(--crit)' : 'var(--low)',
                              boxShadow: `0 0 4px ${f.direction === 'up' ? 'var(--crit-border)' : 'var(--low-border)'}`,
                            }} />
                        </div>
                        <span className="text-[11px] font-mono w-10 text-right" style={{ color: 'var(--tx-4)' }}>
                          {(f.impact * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : alert.raw_features ? (
              <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--tx-5)' }}>
                  Raw Network Features
                </p>
                <div className="bg-black/30 p-3 rounded-lg overflow-x-auto max-h-48 text-[11px] font-mono" style={{ color: 'var(--tx-3)' }}>
                  <pre>{JSON.stringify(alert.raw_features, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="pt-4 text-[11px] font-mono" style={{ color: 'var(--tx-5)', borderTop: '1px solid var(--border)' }}>
                No SHAP explanation features attached to this alert.
              </div>
            )}
          </div>
        ) : (
          <EmptyState message="Alert details not found" />
        )}
      </aside>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--tx-2)',
  fontSize: 12,
  fontFamily: 'JetBrains Mono, monospace',
  padding: '6px 12px',
  outline: 'none',
}

export default function AlertsPage() {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize] = useState<number>(15)
  const [totalPages, setTotalPages] = useState<number>(1)

  // Filter state
  const [severityFilter, setSeverityFilter] = useState<string>('ALL')
  const [stageFilter, setStageFilter] = useState<string>('ALL')
  const [minConfidence, setMinConfidence] = useState<number>(0)
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Real WebSockets stream `/ws/alerts`
  const { lastMessage: wsMsg } = useWebSocket<WebSocketMessage>('/ws/alerts')

  // Fetch real alerts from backend GET /alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      }
      if (severityFilter !== 'ALL') params.severity = severityFilter.toLowerCase()
      if (stageFilter !== 'ALL') params.stage = Number(stageFilter)
      if (searchTerm.trim()) params.search = searchTerm.trim()

      const res = await apiClient.get<AlertListResponse | Alert[]>('/alerts', { params })
      const data = res.data

      if (Array.isArray(data)) {
        setAlerts(data)
        setTotal(data.length)
        setTotalPages(1)
      } else if (data && Array.isArray(data.items)) {
        setAlerts(data.items)
        setTotal(data.total || data.items.length)
        setPage(data.page || 1)
        setTotalPages(data.total_pages || Math.ceil((data.total || data.items.length) / pageSize) || 1)
      } else {
        setAlerts([])
        setTotal(0)
        setTotalPages(1)
      }
    } catch (err) {
      console.error('Failed to fetch alerts from backend:', err)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, severityFilter, stageFilter, searchTerm])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Process incoming real-time WebSocket alerts
  useEffect(() => {
    if (!wsMsg) return

    const incoming: Alert | null = 'id' in wsMsg && 'severity' in wsMsg
      ? (wsMsg as Alert)
      : null

    if (incoming) {
      setAlerts(prev => {
        if (prev.some(a => a.id === incoming.id)) return prev
        return [incoming, ...prev].slice(0, pageSize)
      })
      setTotal(prev => prev + 1)
    }
  }, [wsMsg, pageSize])

  // Filter alerts by minConfidence in memory
  const displayAlerts = useMemo(() => {
    return alerts.filter(a => (a.confidence ?? 0) >= minConfidence / 100)
  }, [alerts, minConfidence])

  const handleDeleteSuccess = (deletedId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== deletedId))
    setTotal(prev => Math.max(prev - 1, 0))
  }

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHeader title="Alert Management" sub={`Displaying ${displayAlerts.length} of ${total} total detections`}>
          <button
            onClick={() => fetchAlerts()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </SectionHeader>

        {/* Filters & Search Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-5 select-none">
          {/* Search box */}
          <div className="relative flex items-center min-w-[200px]">
            <Search size={13} className="absolute left-3" style={{ color: 'var(--tx-5)' }} />
            <input
              type="text"
              placeholder="Search IP, Attack Type, ID..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1) }}
              style={{ ...inputStyle, paddingLeft: 30, width: '100%' }}
            />
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={12} style={{ color: 'var(--tx-5)' }} />
            <select
              style={inputStyle}
              value={severityFilter}
              onChange={e => { setSeverityFilter(e.target.value); setPage(1) }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Stage filter */}
          <select
            style={inputStyle}
            value={stageFilter}
            onChange={e => { setStageFilter(e.target.value); setPage(1) }}
          >
            <option value="ALL">All Stages</option>
            <option value="1">Stage 1 — Known Attacks</option>
            <option value="2">Stage 2 — Zero-Day Anomalies</option>
          </select>

          {/* Min Confidence Slider */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono" style={{ color: 'var(--tx-5)' }}>Min Conf</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minConfidence}
              onChange={e => setMinConfidence(Number(e.target.value))}
              style={{ accentColor: 'var(--accent)', width: 85 }}
            />
            <span className="text-[11px] font-mono w-8" style={{ color: 'var(--accent)' }}>{minConfidence}%</span>
          </div>
        </div>

        {/* Alerts Table */}
        {loading && displayAlerts.length === 0 ? (
          <LoadingState />
        ) : displayAlerts.length > 0 ? (
          <Table headers={['ID', 'Timestamp', 'Source IP', 'Dest IP', 'Proto', 'Stage', 'Attack Type', 'Severity', 'Confidence']}>
            {displayAlerts.map(a => {
              const sevUpper = SEVERITY_MAP[a.severity || 'low'] ?? 'LOW'
              return (
                <Tr key={a.id} onClick={() => setSelectedAlertId(a.id)}>
                  <Td mono muted>{a.id.slice(0, 8)}...</Td>
                  <Td mono muted>{a.timestamp ? a.timestamp.replace('T', ' ').slice(11, 19) : 'N/A'}</Td>
                  <Td><IP>{a.src_ip || 'N/A'}</IP></Td>
                  <Td mono muted>{a.dst_ip || 'N/A'}</Td>
                  <Td mono muted>{a.protocol || 'TCP'}</Td>
                  <Td mono muted>Stage {a.stage}</Td>
                  <Td>{a.attack_type || (a.stage === 2 ? 'Anomaly (Stage 2)' : 'Unknown')}</Td>
                  <Td><SeverityBadge severity={sevUpper} /></Td>
                  <Td mono muted>{typeof a.confidence === 'number' ? (a.confidence * 100).toFixed(0) + '%' : 'N/A'}</Td>
                </Tr>
              )
            })}
          </Table>
        ) : (
          <EmptyState message="No security alerts match the current filter criteria" />
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 select-none" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-[11px] font-mono" style={{ color: 'var(--tx-4)' }}>
              Page {page} of {totalPages} ({total} total alerts)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="p-1.5 rounded disabled:opacity-40"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                className="p-1.5 rounded disabled:opacity-40"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* Alert Detail Drawer */}
      {selectedAlertId && (
        <AlertDrawer
          alertId={selectedAlertId}
          onClose={() => setSelectedAlertId(null)}
          onDelete={handleDeleteSuccess}
        />
      )}
    </div>
  )
}
