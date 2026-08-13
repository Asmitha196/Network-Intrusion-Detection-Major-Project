import { useState, useEffect, useCallback } from 'react'
import { Play, RefreshCw, ChevronRight, AlertTriangle } from 'lucide-react'
import apiClient from '../api/client'
import { Panel, SectionHeader, SeverityBadge, Severity } from '../components/ui'

const ATTACK_PATTERNS: Array<{ id: string; label: string; desc: string; severity: Severity }> = [
  { id: 'Port Scan',   label: 'Port Scan',   desc: 'TCP/UDP port enumeration', severity: 'HIGH' },
  { id: 'SYN Flood',   label: 'SYN Flood',   desc: 'TCP half-open connection flood', severity: 'CRITICAL' },
  { id: 'ICMP Flood',  label: 'ICMP Flood',  desc: 'ICMP echo request flood', severity: 'HIGH' },
  { id: 'UDP Flood',   label: 'UDP Flood',   desc: 'UDP datagram flood', severity: 'HIGH' },
  { id: 'Brute Force', label: 'Brute Force', desc: 'Credential stuffing attack', severity: 'CRITICAL' },
  { id: 'DNS Flood',   label: 'DNS Flood',   desc: 'DNS query amplification', severity: 'MEDIUM' },
  { id: 'HTTP Flood',  label: 'HTTP Flood',  desc: 'Layer 7 HTTP GET/POST flood', severity: 'HIGH' },
  { id: 'Slowloris',   label: 'Slowloris',   desc: 'Slow HTTP connection hold', severity: 'MEDIUM' },
]

interface SimulationResult {
  simulation_id: string
  attack_type: string
  status: string
  packets_generated: number
  flows_generated: number
  detection_time_ms: number
  known_attack_result: string
  unknown_attack_result: string
  timestamp: string
  message: string
  target_ip?: string
  packet_count_requested?: number
}

const PIPELINE_STEPS = [
  'SELECT ATTACK',
  'CONFIGURE TARGET',
  'POST /SIMULATION/RUN',
  'PUSH REDIS STREAM',
  'STAGE 1 ML WORKER',
  'STAGE 2 AUTOENCODER',
  'ALERT BROADCAST',
]

export default function SimulationPage() {
  const [selectedAttack, setSelectedAttack] = useState<string>('SYN Flood')
  const [targetIp, setTargetIp] = useState<string>('172.16.0.5')
  const [packetCount, setPacketCount] = useState<number>(100)
  const [availablePatterns, setAvailablePatterns] = useState<string[]>([])

  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<number>(-1)

  // Fetch backend GET /simulation
  const fetchPatterns = useCallback(async () => {
    try {
      const res = await apiClient.get<any>('/simulation')
      if (res.data?.available_patterns) {
        setAvailablePatterns(res.data.available_patterns)
      }
    } catch (err) {
      console.error('Failed to fetch available simulation patterns:', err)
    }
  }, [])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  // Run Real Simulation: POST /simulation/run
  const handleRunSimulation = async () => {
    if (!selectedAttack) return

    setLoading(true)
    setError(null)
    setResult(null)
    setActiveStep(0)

    // Step animation simulation for visual feedback
    const timer = setInterval(() => {
      setActiveStep(prev => (prev < 3 ? prev + 1 : prev))
    }, 250)

    try {
      // Send exact request schema: { attack_type, packet_count, target_ip }
      const payload = {
        attack_type: selectedAttack,
        packet_count: Number(packetCount),
        target_ip: targetIp.trim(),
      }

      const res = await apiClient.post<SimulationResult>('/simulation/run', payload)
      clearInterval(timer)
      setActiveStep(6)
      setResult({
        ...res.data,
        target_ip: targetIp.trim(),
        packet_count_requested: Number(packetCount),
      })
    } catch (err: any) {
      clearInterval(timer)
      setActiveStep(-1)
      console.error('Simulation execution error:', err)
      setError(err.response?.data?.detail || err.message || 'Simulation run failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 select-none">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Attack selection panel */}
        <Panel className="lg:col-span-1">
          <SectionHeader title="Attack Pattern" sub="Select demonstration attack scenario" />
          <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
            {ATTACK_PATTERNS.map(a => {
              const isAvailable = availablePatterns.length === 0 || availablePatterns.includes(a.id)
              const isSelected = selectedAttack === a.id
              return (
                <button
                  key={a.id}
                  disabled={loading || !isAvailable}
                  onClick={() => { setSelectedAttack(a.id); setResult(null); setError(null); setActiveStep(-1) }}
                  className="w-full text-left p-3 rounded-lg border transition-all text-left"
                  style={{
                    background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                    borderColor: isSelected ? 'var(--accent-border)' : 'var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold" style={{ color: isSelected ? 'var(--accent)' : 'var(--tx-1)' }}>
                      {a.label}
                    </span>
                    <SeverityBadge severity={a.severity} />
                  </div>
                  <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--tx-4)' }}>{a.desc}</p>
                </button>
              )
            })}
          </div>
        </Panel>

        {/* Configuration + Pipeline + Results */}
        <div className="lg:col-span-2 space-y-4">
          <Panel>
            <SectionHeader title="Simulation Configuration" sub="Configure target IP and packet batch size" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-5)' }}>
                  Target IP Address
                </label>
                <input
                  type="text"
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg outline-none transition-colors"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-1)' }}
                  value={targetIp}
                  onChange={e => setTargetIp(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-5)' }}>
                  Packet Count (10 – 10,000)
                </label>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  step={10}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg outline-none transition-colors"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-1)' }}
                  value={packetCount}
                  onChange={e => setPacketCount(Math.max(10, Math.min(10000, Number(e.target.value))))}
                />
              </div>
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={loading || !selectedAttack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-40"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Executing Simulation…</span>
                </>
              ) : (
                <>
                  <Play size={14} />
                  <span>Run {selectedAttack} Simulation</span>
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 rounded-lg flex items-center gap-2 text-[12px] font-mono"
                style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }}>
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}
          </Panel>

          {/* Pipeline Step Display */}
          <Panel>
            <SectionHeader title="Detection Pipeline Flow" sub="Redis Stream → Flow Consumer Worker → Stage 1/2 ML" />
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {PIPELINE_STEPS.map((step, i) => {
                const isActive = activeStep === i
                const isPassed = activeStep > i
                return (
                  <div key={step} className="flex items-center gap-1 shrink-0">
                    <div
                      className="px-2.5 py-1.5 rounded text-[10px] font-mono font-medium border transition-all"
                      style={isPassed ? {
                        borderColor: 'var(--low-border)', background: 'var(--low-dim)', color: 'var(--low)'
                      } : isActive ? {
                        borderColor: 'var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)'
                      } : {
                        borderColor: 'var(--border)', color: 'var(--tx-5)'
                      }}
                    >
                      {step}
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <ChevronRight size={12} style={{ color: isPassed ? 'var(--low)' : 'var(--border)' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Real Simulation Results */}
          {result && (
            <Panel style={{ border: '2px solid var(--low-border)' }}>
              <SectionHeader title="Real Simulation Results" sub="Backend execution telemetry output" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  ['Attack Type', result.attack_type],
                  ['Packet Count', (result.packet_count_requested ?? result.packets_generated).toLocaleString()],
                  ['Target IP', result.target_ip || '172.16.0.5'],
                  ['Packets Generated', result.packets_generated.toLocaleString()],
                  ['Flows Generated', result.flows_generated.toLocaleString()],
                  ['Detection Time', `${result.detection_time_ms} ms`],
                  ['Status', result.status],
                ].map(([k, v]) => (
                  <div key={k as string} className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--tx-5)' }}>{k}</p>
                    <p className="text-xs font-mono font-bold" style={{ color: 'var(--tx-1)' }}>{v}</p>
                  </div>
                ))}

                {/* Stage 1 Result */}
                <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--crit-border)' }}>
                  <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--tx-5)' }}>Stage 1 Result</p>
                  <p className="text-xs font-mono font-bold" style={{ color: 'var(--crit)' }}>
                    {result.known_attack_result}
                  </p>
                </div>

                {/* Stage 2 Result */}
                <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--accent-border)' }}>
                  <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--tx-5)' }}>Stage 2 Result</p>
                  <p className="text-xs font-mono font-bold" style={{ color: 'var(--accent)' }}>
                    {result.unknown_attack_result}
                  </p>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
