import { useState, useEffect, useCallback, useRef } from 'react'
import { HardDriveUpload, RefreshCw, CheckCircle2, AlertTriangle, Play, Clock } from 'lucide-react'
import apiClient from '../api/client'
import { StatCard, SectionHeader, Panel, Table, Tr, Td, EmptyState } from '../components/ui'

interface PcapJobStatus {
  job_id: string
  filename: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | string
  total_flows: number
  error: string
  created_at: string
  started_at?: string
  completed_at?: string
  failed_at?: string
}

function StatusBadge({ status }: { status: string }) {
  const s = String(status).toLowerCase()
  if (s === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold"
        style={{ background: 'var(--low-dim)', border: '1px solid var(--low-border)', color: 'var(--low)' }}>
        <CheckCircle2 size={10} />
        <span>COMPLETED</span>
      </span>
    )
  }
  if (s === 'processing' || s === 'queued') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold animate-pulse"
        style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>
        <Clock size={10} />
        <span className="uppercase">{s}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold"
      style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }}>
      <AlertTriangle size={10} />
      <span className="uppercase">{s}</span>
    </span>
  )
}

export default function ReplayPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState<boolean>(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<PcapJobStatus | null>(null)
  const [jobsHistory, setJobsHistory] = useState<PcapJobStatus[]>([])
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Poll status for active job: GET /ingest/pcap/{job_id}
  const pollJobStatus = useCallback(async (id: string) => {
    try {
      const res = await apiClient.get<PcapJobStatus>(`/ingest/pcap/${encodeURIComponent(id)}`)
      const data = res.data
      setJobStatus(data)

      // Add/update jobs history list
      setJobsHistory(prev => {
        const idx = prev.findIndex(j => j.job_id === id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = data
          return updated
        }
        return [data, ...prev]
      })

      return data
    } catch (err: any) {
      console.error(`Failed to fetch PCAP job status for ${id}:`, err)
      return null
    }
  }, [])

  // Auto poll status if job is queued or processing
  useEffect(() => {
    if (!activeJobId) return

    let timer: NodeJS.Timeout | null = null

    const check = async () => {
      const st = await pollJobStatus(activeJobId)
      if (st && (st.status === 'queued' || st.status === 'processing')) {
        timer = setTimeout(check, 3000)
      }
    }

    check()

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [activeJobId, pollJobStatus])

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      const name = f.name
      if (!name.toLowerCase().endsWith('.pcap') && !name.toLowerCase().endsWith('.pcapng')) {
        setError('Invalid file format. Please upload a valid .pcap or .pcapng packet capture file.')
        setSelectedFile(null)
        return
      }
      setError(null)
      setSelectedFile(f)
    }
  }

  // Submit PCAP File Upload: POST /ingest/pcap
  const handleUploadPcap = async () => {
    if (!selectedFile) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      // POST /ingest/pcap (multipart/form-data)
      const res = await apiClient.post<any>('/ingest/pcap', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const newJobId = res.data?.job_id
      if (newJobId) {
        setActiveJobId(newJobId)
        await pollJobStatus(newJobId)
      }
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      console.error('PCAP Upload Failed:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to upload PCAP capture file.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5 max-w-4xl select-none">
      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="PCAP Replay Status" value={jobStatus?.status ? jobStatus.status.toUpperCase() : 'READY'} sub="Capture ingestion engine" accent />
        <StatCard label="Current Job ID"      value={activeJobId ? activeJobId.slice(0, 8) + '...' : 'NONE'} sub="Active job session" />
        <StatCard label="Extracted Flows"    value={jobStatus?.total_flows?.toLocaleString() ?? 0} sub="Pushed to Redis Stream" accent={(jobStatus?.total_flows ?? 0) > 0} />
        <StatCard label="Replay Jobs Logged" value={jobsHistory.length} sub="Historical capture files" />
      </div>

      {/* ── PCAP UPLOADER PANEL ── */}
      <Panel>
        <SectionHeader title="PCAP Capture File Upload & Background Replay" sub="Upload .pcap or .pcapng network capture files for live ML pipeline ingestion" />

        <div className="p-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center my-4 transition-colors"
          style={{ background: 'var(--surface-2)', borderColor: selectedFile ? 'var(--accent-border)' : 'var(--border)' }}>
          <HardDriveUpload size={32} className="mb-2" style={{ color: selectedFile ? 'var(--accent)' : 'var(--tx-4)' }} />
          <p className="text-xs font-mono font-semibold" style={{ color: 'var(--tx-1)' }}>
            {selectedFile ? selectedFile.name : 'Select or drag a .pcap / .pcapng capture file'}
          </p>
          <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--tx-5)' }}>
            Maximum capture file size: 500 MB (RFC 1035 / PCAPng format supported)
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pcap,.pcapng"
            onChange={handleFileChange}
            className="hidden"
            id="pcapFileInput"
          />

          <div className="flex items-center gap-3 mt-4">
            <label
              htmlFor="pcapFileInput"
              className="px-4 py-2 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-all"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx-2)' }}
            >
              Choose PCAP File
            </label>

            {selectedFile && (
              <button
                onClick={handleUploadPcap}
                disabled={uploading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-40"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
              >
                {uploading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Uploading Capture…</span>
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    <span>Start Replay Job</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg flex items-center gap-2 text-[12px] font-mono"
            style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }}>
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}
      </Panel>

      {/* ── ACTIVE JOB TRACKER PANEL ── */}
      {jobStatus && (
        <Panel style={{ border: '2px solid var(--accent-border)' }}>
          <SectionHeader title={`Active Replay Job: ${jobStatus.filename}`} sub={`Job ID: ${jobStatus.job_id}`}>
            <button
              onClick={() => pollJobStatus(jobStatus.job_id)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-mono"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-3)' }}
            >
              <RefreshCw size={11} />
              <span>Refresh Status</span>
            </button>
          </SectionHeader>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-3 text-[12px] font-mono">
            <div className="p-3 rounded-lg bg-black/20">
              <span className="text-[10px] uppercase text-gray-400 block mb-1">Filename</span>
              <span className="font-bold text-white truncate block">{jobStatus.filename}</span>
            </div>

            <div className="p-3 rounded-lg bg-black/20">
              <span className="text-[10px] uppercase text-gray-400 block mb-1">Job Status</span>
              <StatusBadge status={jobStatus.status} />
            </div>

            <div className="p-3 rounded-lg bg-black/20">
              <span className="text-[10px] uppercase text-gray-400 block mb-1">Extracted Flows</span>
              <span className="font-bold text-cyan-400">{jobStatus.total_flows.toLocaleString()}</span>
            </div>

            <div className="p-3 rounded-lg bg-black/20">
              <span className="text-[10px] uppercase text-gray-400 block mb-1">Upload Date</span>
              <span className="text-gray-300">{jobStatus.created_at ? jobStatus.created_at.replace('T', ' ').slice(0, 19) : 'N/A'}</span>
            </div>
          </div>

          {jobStatus.error && (
            <div className="p-3 rounded-lg mt-3 text-[11px] font-mono"
              style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }}>
              <strong>Replay Job Errors:</strong> {jobStatus.error}
            </div>
          )}
        </Panel>
      )}

      {/* ── HISTORICAL REPLAY JOBS TABLE ── */}
      <Panel>
        <SectionHeader title="PCAP Replay Job History" sub="Historical capture ingestion jobs" />
        {jobsHistory.length > 0 ? (
          <Table headers={['Filename', 'Job ID', 'Status', 'Extracted Flows', 'Errors', 'Action']}>
            {jobsHistory.map(j => (
              <Tr key={j.job_id} onClick={() => { setActiveJobId(j.job_id); pollJobStatus(j.job_id) }}>
                <Td font-bold>{j.filename}</Td>
                <Td mono muted>{j.job_id.slice(0, 8)}...</Td>
                <Td><StatusBadge status={j.status} /></Td>
                <Td mono font-bold>{j.total_flows.toLocaleString()}</Td>
                <Td mono muted>{j.error || 'None'}</Td>
                <Td muted>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveJobId(j.job_id); pollJobStatus(j.job_id) }}
                    className="text-[11px] font-mono underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    Inspect Status
                  </button>
                </Td>
              </Tr>
            ))}
          </Table>
        ) : (
          <EmptyState message="No PCAP capture replay jobs executed yet" />
        )}
      </Panel>
    </div>
  )
}
