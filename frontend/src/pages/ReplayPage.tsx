import React, { useState, useEffect } from 'react'
import apiClient from '../api/client'

interface PcapJobStatus {
  job_id: string
  filename: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | string
  total_flows: number
  error: string
  created_at: string
  completed_at?: string
  failed_at?: string
}

export default function ReplayPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState<boolean>(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeJobStatus, setActiveJobStatus] = useState<PcapJobStatus | null>(null)
  const [jobHistory, setJobHistory] = useState<PcapJobStatus[]>([])
  const [message, setMessage] = useState<string>('')

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  // Upload PCAP
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      alert('Please select a .pcap or .pcapng file first.')
      return
    }

    setUploading(true)
    setMessage('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await apiClient.post<{ job_id: string; message: string }>('/ingest/pcap', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const jobId = res.data.job_id
      setActiveJobId(jobId)
      setMessage(`PCAP uploaded successfully! Job ID: ${jobId}`)
      setFile(null)
    } catch (err: any) {
      alert('Upload failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setUploading(false)
    }
  }

  // Poll active job status
  useEffect(() => {
    if (!activeJobId) return

    let cancelled = false
    async function pollJob() {
      try {
        const res = await apiClient.get<PcapJobStatus>(`/ingest/pcap/${activeJobId}`)
        if (cancelled) return

        setActiveJobStatus(res.data)

        // Add to history
        setJobHistory((prev) => {
          const exists = prev.some((j) => j.job_id === res.data.job_id)
          if (exists) {
            return prev.map((j) => (j.job_id === res.data.job_id ? res.data : j))
          }
          return [res.data, ...prev]
        })

        // Stop polling if completed or failed
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          return
        }
      } catch (e) {
        console.warn('Failed to poll job status:', e)
      }
    }

    pollJob()
    const timer = setInterval(pollJob, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [activeJobId])

  const getStatusStyle = (st: string) => {
    switch (st.toLowerCase()) {
      case 'completed':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981' }
      case 'processing':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid #3b82f6' }
      case 'failed':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444' }
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #f59e0b' }
    }
  }

  return (
    <div style={styles.container}>
      <div>
        <h2 style={styles.pageTitle}>PCAP Replay & Offline Traffic Ingestion</h2>
        <span style={styles.pageSubtitle}>
          Upload raw packet capture (.pcap / .pcapng) files for background extraction and ML detection
        </span>
      </div>

      {/* Upload Box */}
      <div style={styles.uploadCard}>
        <h3 style={styles.cardTitle}>Upload Capture File</h3>

        <form onSubmit={handleUpload} style={styles.form}>
          <input
            type="file"
            accept=".pcap,.pcapng"
            onChange={handleFileChange}
            style={styles.fileInput}
          />

          <button
            type="submit"
            disabled={uploading || !file}
            style={{
              ...styles.uploadBtn,
              opacity: uploading || !file ? 0.6 : 1,
              cursor: uploading || !file ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Uploading PCAP...' : 'Start Background Replay'}
          </button>
        </form>

        {message && <div style={styles.successMessage}>{message}</div>}
      </div>

      {/* Active Job Progress */}
      {activeJobStatus && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Current Replay Job Status</h3>
          <div style={styles.activeJobBox}>
            <div style={styles.jobRow}>
              <span style={styles.label}>Job ID:</span>
              <span style={styles.valMono}>{activeJobStatus.job_id}</span>
            </div>
            <div style={styles.jobRow}>
              <span style={styles.label}>Filename:</span>
              <span style={styles.val}>{activeJobStatus.filename}</span>
            </div>
            <div style={styles.jobRow}>
              <span style={styles.label}>Status:</span>
              <span style={{ ...styles.statusBadge, ...getStatusStyle(activeJobStatus.status) }}>
                {activeJobStatus.status.toUpperCase()}
              </span>
            </div>
            {activeJobStatus.status === 'completed' && (
              <div style={styles.jobRow}>
                <span style={styles.label}>Extracted Flows:</span>
                <span style={{ ...styles.val, color: '#10b981', fontWeight: 700 }}>
                  {activeJobStatus.total_flows} flows published to ids:flows
                </span>
              </div>
            )}
            {activeJobStatus.status === 'failed' && (
              <div style={styles.errorBox}>
                <strong>Replay Failed:</strong> {activeJobStatus.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job History */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Replay Job History</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Job ID</th>
              <th style={styles.th}>Filename</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Extracted Flows</th>
              <th style={styles.th}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {jobHistory.length === 0 ? (
              <tr>
                <td colSpan={5} style={styles.emptyTd}>
                  No previous PCAP replay jobs recorded in this session.
                </td>
              </tr>
            ) : (
              jobHistory.map((job) => (
                <tr key={job.job_id} style={styles.tr}>
                  <td style={styles.tdMono}>{job.job_id}</td>
                  <td style={styles.td}>{job.filename}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusBadge, ...getStatusStyle(job.status) }}>
                      {job.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={styles.td}>{job.total_flows}</td>
                  <td style={styles.td}>{job.created_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
  uploadCard: {
    backgroundColor: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  card: {
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
    marginBottom: '12px',
  },
  form: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  fileInput: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    color: '#f0f6fc',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
  },
  uploadBtn: {
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '13px',
  },
  successMessage: {
    color: '#10b981',
    fontSize: '12px',
    fontWeight: 600,
  },
  activeJobBox: {
    backgroundColor: '#161b22',
    border: '1px solid #21262d',
    padding: '16px',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  jobRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    fontSize: '13px',
  },
  label: {
    color: '#8b949e',
    width: '120px',
  },
  val: {
    color: '#f0f6fc',
  },
  valMono: {
    color: '#58a6ff',
    fontFamily: 'monospace',
  },
  statusBadge: {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: 700,
  },
  errorBox: {
    marginTop: '8px',
    padding: '10px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#ef4444',
    borderRadius: '6px',
    fontSize: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '1px solid #30363d',
    color: '#8b949e',
    fontSize: '11px',
    textTransform: 'uppercase',
  },
  tr: {
    borderBottom: '1px solid #21262d',
  },
  td: {
    padding: '10px',
    color: '#c9d1d9',
  },
  tdMono: {
    padding: '10px',
    fontFamily: 'monospace',
    color: '#58a6ff',
  },
  emptyTd: {
    padding: '24px',
    textAlign: 'center',
    color: '#6e7681',
  },
}
