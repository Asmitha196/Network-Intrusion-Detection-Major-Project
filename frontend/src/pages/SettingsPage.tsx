import React, { useState, useEffect } from 'react'
import apiClient from '../api/client'
import type { SystemHealth } from '../types'

export default function SettingsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await apiClient.get<SystemHealth>('/health')
        setHealth(res.data)
      } catch (e) {
        console.warn('Failed to fetch health status:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [])

  return (
    <div style={styles.container}>
      <div>
        <h2 style={styles.pageTitle}>System Health & Infrastructure Diagnostics</h2>
        <span style={styles.pageSubtitle}>
          Core engine health, model artifact verification, and system status
        </span>
      </div>

      {loading ? (
        <div style={styles.loading}>Checking infrastructure health...</div>
      ) : (
        <div style={styles.grid}>
          {/* API Engine Status */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>FastAPI Gateway</h3>
            <div style={styles.itemRow}>
              <span style={styles.label}>Status:</span>
              <span style={{ ...styles.badge, backgroundColor: health?.status === 'ok' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: health?.status === 'ok' ? '#10b981' : '#ef4444' }}>
                {health?.status.toUpperCase()}
              </span>
            </div>
            <div style={styles.itemRow}>
              <span style={styles.label}>Version:</span>
              <span style={styles.val}>{health?.version}</span>
            </div>
            <div style={styles.itemRow}>
              <span style={styles.label}>Application Uptime:</span>
              <span style={styles.val}>{health?.uptime_seconds} seconds</span>
            </div>
          </div>

          {/* PostgreSQL + TimescaleDB Status */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>PostgreSQL + TimescaleDB</h3>
            <div style={styles.itemRow}>
              <span style={styles.label}>Connection State:</span>
              <span style={{ ...styles.badge, backgroundColor: health?.postgres ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: health?.postgres ? '#10b981' : '#ef4444' }}>
                {health?.postgres ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <div style={styles.itemRow}>
              <span style={styles.label}>Database Engine:</span>
              <span style={styles.val}>TimescaleDB PostgreSQL 16</span>
            </div>
            <div style={styles.itemRow}>
              <span style={styles.label}>Hypertables:</span>
              <span style={styles.val}>flow_records, alerts</span>
            </div>
          </div>

          {/* Redis Streams Broker Status */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Redis Stream Broker</h3>
            <div style={styles.itemRow}>
              <span style={styles.label}>Connection State:</span>
              <span style={{ ...styles.badge, backgroundColor: health?.redis ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: health?.redis ? '#10b981' : '#ef4444' }}>
                {health?.redis ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <div style={styles.itemRow}>
              <span style={styles.label}>Active Streams:</span>
              <span style={styles.val}>ids:flows, ids:pcap_jobs</span>
            </div>
          </div>

          {/* Background Worker Status */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Flow Consumer Worker</h3>
            <div style={styles.itemRow}>
              <span style={styles.label}>Worker State:</span>
              <span style={{ ...styles.badge, backgroundColor: health?.worker_status === 'running' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: health?.worker_status === 'running' ? '#10b981' : '#f59e0b' }}>
                {health?.worker_status.toUpperCase()}
              </span>
            </div>
            <div style={styles.itemRow}>
              <span style={styles.label}>Heartbeat Key:</span>
              <span style={styles.valMono}>ids:worker:heartbeat</span>
            </div>
          </div>

          {/* ML Models Status */}
          <div style={styles.cardSpan2}>
            <h3 style={styles.cardTitle}>ML Detection Models Load Verification</h3>
            <div style={styles.modelGrid}>
              <div style={styles.modelItem}>
                <span style={styles.modelName}>Stage 1: RandomForest / XGBoost</span>
                <span style={{ ...styles.badge, backgroundColor: health?.ml_models_loaded.classifier ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: health?.ml_models_loaded.classifier ? '#10b981' : '#ef4444' }}>
                  {health?.ml_models_loaded.classifier ? 'LOADED IN MEMORY' : 'MISSING ARTIFACT'}
                </span>
                <span style={styles.modelDesc}>Multi-class known attack classifier</span>
              </div>

              <div style={styles.modelItem}>
                <span style={styles.modelName}>Stage 2: PyTorch Autoencoder</span>
                <span style={{ ...styles.badge, backgroundColor: health?.ml_models_loaded.autoencoder ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: health?.ml_models_loaded.autoencoder ? '#10b981' : '#ef4444' }}>
                  {health?.ml_models_loaded.autoencoder ? 'LOADED IN MEMORY' : 'MISSING ARTIFACT'}
                </span>
                <span style={styles.modelDesc}>Zero-day anomaly detector neural network</span>
              </div>
            </div>
          </div>
        </div>
      )}
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
  loading: {
    color: '#8b949e',
    fontSize: '13px',
    padding: '40px',
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardSpan2: {
    gridColumn: '1 / -1',
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '20px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#f0f6fc',
    marginBottom: '8px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
  },
  label: {
    color: '#8b949e',
  },
  val: {
    color: '#f0f6fc',
    fontWeight: 600,
  },
  valMono: {
    color: '#58a6ff',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  badge: {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  modelGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginTop: '12px',
  },
  modelItem: {
    backgroundColor: '#161b22',
    border: '1px solid #21262d',
    padding: '16px',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  modelName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f0f6fc',
  },
  modelDesc: {
    fontSize: '11px',
    color: '#8b949e',
  },
}
