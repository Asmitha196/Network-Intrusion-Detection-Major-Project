import React, { useState, useEffect, useCallback } from 'react'
import RecentAlertsTable from '../components/RecentAlertsTable'
import AlertDetailDrawer from '../components/AlertDetailDrawer'
import apiClient from '../api/client'
import type { Alert, AlertListResponse } from '../types'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize] = useState<number>(20)
  const [totalPages, setTotalPages] = useState<number>(1)

  // Filter States
  const [severity, setSeverity] = useState<string>('')
  const [attackType, setAttackType] = useState<string>('')
  const [minConfidence, setMinConfidence] = useState<number>(0.0)
  const [sortBy, setSortBy] = useState<string>('timestamp')
  const [order, setOrder] = useState<string>('desc')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        sort_by: sortBy,
        order: order,
      })

      if (severity) params.append('severity', severity)
      if (attackType) params.append('attack_type', attackType)
      if (minConfidence > 0) params.append('min_confidence', minConfidence.toString())

      const res = await apiClient.get<AlertListResponse>(`/alerts?${params.toString()}`)
      setAlerts(res.data.items || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.total_pages || 1)
    } catch (e) {
      console.warn('Failed to fetch filtered alerts:', e)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, severity, attackType, minConfidence, sortBy, order])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.pageTitle}>Security Alerts Registry</h2>
          <span style={styles.pageSubtitle}>
            Full history of Stage 1 & Stage 2 detected threats ({total} total records)
          </span>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div style={styles.filterCard}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Severity</label>
          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value)
              setPage(1)
            }}
            style={styles.select}
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Attack Label</label>
          <input
            type="text"
            placeholder="e.g. DoS Hulk, PortScan"
            value={attackType}
            onChange={(e) => {
              setAttackType(e.target.value)
              setPage(1)
            }}
            style={styles.input}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Min Confidence: {(minConfidence * 100).toFixed(0)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={minConfidence}
            onChange={(e) => {
              setMinConfidence(parseFloat(e.target.value))
              setPage(1)
            }}
            style={styles.slider}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={styles.select}
          >
            <option value="timestamp">Timestamp</option>
            <option value="confidence">Confidence</option>
            <option value="severity">Severity</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Order</label>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            style={styles.select}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.loadingText}>Querying PostgreSQL + TimescaleDB alerts index...</div>
        ) : (
          <RecentAlertsTable alerts={alerts} onSelectAlert={(a) => setSelectedAlert(a)} />
        )}

        {/* Pagination Bar */}
        <div style={styles.paginationBar}>
          <span style={styles.pageInfo}>
            Page {page} of {totalPages} ({total} alerts)
          </span>

          <div style={styles.pageBtns}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={styles.pageBtn}
            >
              ← Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={styles.pageBtn}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <AlertDetailDrawer
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onAlertDeleted={() => fetchAlerts()}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f0f6fc',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '12px',
    color: '#8b949e',
  },
  filterCard: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    alignItems: 'flex-end',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '160px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8b949e',
    textTransform: 'uppercase',
  },
  select: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#f0f6fc',
    padding: '6px 10px',
    fontSize: '12px',
    outline: 'none',
  },
  input: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#f0f6fc',
    padding: '6px 10px',
    fontSize: '12px',
    outline: 'none',
  },
  slider: {
    accentColor: '#3b82f6',
    cursor: 'pointer',
  },
  tableCard: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '16px',
  },
  loadingText: {
    color: '#8b949e',
    fontSize: '13px',
    padding: '40px',
    textAlign: 'center',
  },
  paginationBar: {
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #21262d',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageInfo: {
    fontSize: '12px',
    color: '#8b949e',
  },
  pageBtns: {
    display: 'flex',
    gap: '8px',
  },
  pageBtn: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    color: '#c9d1d9',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
}
