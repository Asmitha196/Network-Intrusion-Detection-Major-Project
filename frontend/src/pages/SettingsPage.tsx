import { useState, useEffect } from 'react'
import apiClient from '../api/client'
import { Panel, SectionHeader, LoadingState, StatCard } from '../components/ui'
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

  const isHealthy = health?.status === 'ok'
  const isPostgresOk = Boolean(health?.postgres)
  const isRedisOk = Boolean(health?.redis)
  const isWorkerOk = health?.worker_status === 'running'

  return (
    <div className="space-y-4 select-none">
      {/* ── TOP OVERVIEW STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Engine Status"
          value={isHealthy ? 'HEALTHY' : 'DEGRADED'}
          sub={`Version ${health?.version ?? '1.0'}`}
          accent={isHealthy}
          critical={!isHealthy}
        />
        <StatCard
          label="TimescaleDB"
          value={isPostgresOk ? 'ONLINE' : 'OFFLINE'}
          sub="Hypertable storage engine"
          accent={isPostgresOk}
          critical={!isPostgresOk}
        />
        <StatCard
          label="Redis Stream"
          value={isRedisOk ? 'ONLINE' : 'OFFLINE'}
          sub="ids:flows stream broker"
          accent={isRedisOk}
          critical={!isRedisOk}
        />
        <StatCard
          label="ML Worker"
          value={isWorkerOk ? 'RUNNING' : 'STOPPED'}
          sub="Dual-Stage detection worker"
          accent={isWorkerOk}
          critical={!isWorkerOk}
        />
      </div>

      {loading && !health ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* FastAPI Gateway Status */}
          <Panel>
            <SectionHeader title="FastAPI Engine Gateway" sub="Asynchronous REST API & WebSocket server" />
            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Connection State</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: isHealthy ? 'var(--low-dim)' : 'var(--crit-dim)',
                    color: isHealthy ? 'var(--low)' : 'var(--crit)',
                    border: `1px solid ${isHealthy ? 'var(--low-border)' : 'var(--crit-border)'}`,
                  }}
                >
                  {health?.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Engine Version</span>
                <span style={{ color: 'var(--tx-1)' }}>{health?.version}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Uptime Duration</span>
                <span style={{ color: 'var(--accent)' }}>{health?.uptime_seconds?.toLocaleString()} seconds</span>
              </div>
            </div>
          </Panel>

          {/* PostgreSQL + TimescaleDB Status */}
          <Panel>
            <SectionHeader title="PostgreSQL + TimescaleDB" sub="Time-series persistence layer" />
            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Connection State</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: isPostgresOk ? 'var(--low-dim)' : 'var(--crit-dim)',
                    color: isPostgresOk ? 'var(--low)' : 'var(--crit)',
                    border: `1px solid ${isPostgresOk ? 'var(--low-border)' : 'var(--crit-border)'}`,
                  }}
                >
                  {isPostgresOk ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Database Engine</span>
                <span style={{ color: 'var(--tx-1)' }}>TimescaleDB PostgreSQL 16</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Hypertables</span>
                <span style={{ color: 'var(--accent)' }}>flow_records, alerts</span>
              </div>
            </div>
          </Panel>

          {/* Redis Streams Broker */}
          <Panel>
            <SectionHeader title="Redis Stream Broker" sub="High-throughput in-memory queue" />
            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Broker Connection</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: isRedisOk ? 'var(--low-dim)' : 'var(--crit-dim)',
                    color: isRedisOk ? 'var(--low)' : 'var(--crit)',
                    border: `1px solid ${isRedisOk ? 'var(--low-border)' : 'var(--crit-border)'}`,
                  }}
                >
                  {isRedisOk ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Active Streams</span>
                <span style={{ color: 'var(--accent)' }}>ids:flows, ids:pcap_jobs</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Consumer Groups</span>
                <span style={{ color: 'var(--tx-1)' }}>ids:flow_consumers</span>
              </div>
            </div>
          </Panel>

          {/* Background Worker */}
          <Panel>
            <SectionHeader title="Flow Consumer Worker" sub="Continuous ML inference pipeline daemon" />
            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Worker State</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: isWorkerOk ? 'var(--low-dim)' : 'var(--crit-dim)',
                    color: isWorkerOk ? 'var(--low)' : 'var(--crit)',
                    border: `1px solid ${isWorkerOk ? 'var(--low-border)' : 'var(--crit-border)'}`,
                  }}
                >
                  {health?.worker_status?.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Heartbeat Key</span>
                <span style={{ color: 'var(--accent)' }}>ids:worker:heartbeat</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--tx-4)' }}>Inference Mode</span>
                <span style={{ color: 'var(--tx-1)' }}>Stage 1 RF + Stage 2 AE + SHAP</span>
              </div>
            </div>
          </Panel>

          {/* ML Models Load Verification */}
          <Panel className="md:col-span-2">
            <SectionHeader title="ML Detection Models Artifact Verification" sub="Status of loaded machine learning artifacts in memory" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold" style={{ color: 'var(--tx-1)' }}>Stage 1: RandomForest / XGBoost</span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                    style={{
                      background: health?.ml_models_loaded?.classifier ? 'var(--low-dim)' : 'var(--crit-dim)',
                      color: health?.ml_models_loaded?.classifier ? 'var(--low)' : 'var(--crit)',
                      border: `1px solid ${health?.ml_models_loaded?.classifier ? 'var(--low-border)' : 'var(--crit-border)'}`,
                    }}
                  >
                    {health?.ml_models_loaded?.classifier ? 'LOADED IN MEMORY' : 'MISSING ARTIFACT'}
                  </span>
                </div>
                <p className="text-[11px] font-mono" style={{ color: 'var(--tx-4)' }}>
                  Supervised multi-class attack classification model (`ml/artifacts/classifier.pkl`)
                </p>
              </div>

              <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold" style={{ color: 'var(--tx-1)' }}>Stage 2: PyTorch Autoencoder</span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                    style={{
                      background: health?.ml_models_loaded?.autoencoder ? 'var(--low-dim)' : 'var(--crit-dim)',
                      color: health?.ml_models_loaded?.autoencoder ? 'var(--low)' : 'var(--crit)',
                      border: `1px solid ${health?.ml_models_loaded?.autoencoder ? 'var(--low-border)' : 'var(--crit-border)'}`,
                    }}
                  >
                    {health?.ml_models_loaded?.autoencoder ? 'LOADED IN MEMORY' : 'MISSING ARTIFACT'}
                  </span>
                </div>
                <p className="text-[11px] font-mono" style={{ color: 'var(--tx-4)' }}>
                  Deep neural network for zero-day anomaly detection (`ml/artifacts/autoencoder.pt`)
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

