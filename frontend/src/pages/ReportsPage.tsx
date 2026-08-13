import { useState, useEffect, useCallback } from 'react'
import { FileText, Download, Plus, RefreshCw, FileCode, FileSpreadsheet } from 'lucide-react'
import apiClient from '../api/client'
import { StatCard, SectionHeader, Panel, Table, Tr, Td, LoadingState, EmptyState } from '../components/ui'
import type { Report } from '../types'

type Period = 'daily' | 'weekly' | 'monthly' | 'custom'

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [generateLoading, setGenerateLoading] = useState<boolean>(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [selectedType, setSelectedType] = useState<Period>('daily')
  const [customTitle, setCustomTitle] = useState<string>('')

  // Fetch reports list: GET /reports
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get<any>('/reports')
      const items = Array.isArray(res.data) ? res.data : (res.data?.reports || [])
      setReports(items)
      if (items.length > 0 && !selectedReport) {
        setSelectedReport(items[0])
      }
    } catch (err) {
      console.error('Failed to fetch SOC reports list:', err)
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [selectedReport])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  // Generate Report: POST /reports/generate
  const handleGenerateReport = async () => {
    try {
      setGenerateLoading(true)
      const payload: Record<string, any> = {
        report_type: selectedType,
      }
      if (customTitle.trim()) {
        payload.title = customTitle.trim()
      }

      const res = await apiClient.post<any>('/reports/generate', payload)
      alert(`Successfully generated ${selectedType.toUpperCase()} SOC Executive Report!`)
      setCustomTitle('')
      await fetchReports()
      if (res.data?.report_id) {
        const newlyCreated: Report = {
          id: res.data.report_id,
          title: res.data.report?.title || `Executive SOC Report (${selectedType})`,
          report_type: selectedType,
          created_at: res.data.created_at || new Date().toISOString(),
          summary: res.data.report || {},
        }
        setSelectedReport(newlyCreated)
      }
    } catch (err: any) {
      console.error('Failed to generate report:', err)
      alert(`Report generation failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setGenerateLoading(false)
    }
  }

  // Export Report: GET /reports/{id}/export?export_format=pdf|csv|json
  const handleExport = (reportId: string, format: 'pdf' | 'csv' | 'json') => {
    const baseURL = apiClient.defaults.baseURL || '/api'
    const exportUrl = `${baseURL}/reports/${encodeURIComponent(reportId)}/export?export_format=${format}`
    window.open(exportUrl, '_blank')
  }

  const activeSummary = selectedReport?.summary
  const metrics = activeSummary?.metrics ?? {}
  const recommendations: string[] = activeSummary?.recommendations ?? []

  return (
    <div className="space-y-5 max-w-5xl select-none">
      <Panel>
        <SectionHeader title="SOC Executive Security Reports" sub="Automated and custom executive reporting engine" />

        {/* Generate Report Form */}
        <div className="p-4 rounded-xl mb-5 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--tx-3)' }}>
            Generate New Report
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {(['daily', 'weekly', 'monthly', 'custom'] as Period[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedType(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all capitalize"
                  style={selectedType === p
                    ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }
                    : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx-4)' }
                  }
                >
                  {p}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Optional Custom Title..."
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              className="flex-1 min-w-[200px] text-xs font-mono px-3 py-1.5 rounded-lg outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx-1)' }}
            />

            <button
              onClick={handleGenerateReport}
              disabled={generateLoading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-40"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
            >
              {generateLoading ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Plus size={13} />
              )}
              <span>Generate Report</span>
            </button>
          </div>
        </div>

        {/* Existing Reports List */}
        {loading && reports.length === 0 ? (
          <LoadingState />
        ) : reports.length > 0 ? (
          <Table headers={['Report ID', 'Title', 'Type', 'Generated Date', 'Export Actions']}>
            {reports.map(r => {
              return (
                <Tr key={r.id} onClick={() => setSelectedReport(r)}>
                  <Td mono muted>{r.id.slice(0, 8)}...</Td>
                  <Td font-bold>{r.title || `Executive SOC Report (${r.report_type})`}</Td>
                  <Td mono muted className="capitalize">{r.report_type}</Td>
                  <Td mono muted>{r.created_at ? r.created_at.replace('T', ' ').slice(0, 19) : 'N/A'}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExport(r.id, 'pdf') }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-semibold"
                        style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }}
                      >
                        <FileText size={10} />
                        <span>PDF</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExport(r.id, 'csv') }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-semibold"
                        style={{ background: 'var(--low-dim)', border: '1px solid var(--low-border)', color: 'var(--low)' }}
                      >
                        <FileSpreadsheet size={10} />
                        <span>CSV</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExport(r.id, 'json') }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-semibold"
                        style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
                      >
                        <FileCode size={10} />
                        <span>JSON</span>
                      </button>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </Table>
        ) : (
          <EmptyState message="No SOC reports generated yet" />
        )}
      </Panel>

      {/* Selected Report Inspection Panel */}
      {selectedReport && (
        <>
          <Panel>
            <SectionHeader
              title={selectedReport.title || `Report: ${selectedReport.id}`}
              sub={`Generated on ${selectedReport.created_at ? selectedReport.created_at.replace('T', ' ').slice(0, 19) : 'N/A'}`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport(selectedReport.id, 'pdf')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold"
                  style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }}
                >
                  <Download size={12} />
                  <span>Download PDF</span>
                </button>
              </div>
            </SectionHeader>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-4">
              <StatCard label="Total Window Alerts"  value={metrics.total_alerts?.toLocaleString() ?? 0} accent />
              <StatCard label="Known Attacks"       value={metrics.known_attacks?.toLocaleString() ?? 0} />
              <StatCard label="Zero-Day Anomalies"  value={metrics.zero_day_anomalies?.toLocaleString() ?? 0} critical={(metrics.zero_day_anomalies ?? 0) > 0} />
              <StatCard label="Critical Severity"   value={metrics.critical_severity?.toLocaleString() ?? 0} critical={(metrics.critical_severity ?? 0) > 0} />
            </div>
          </Panel>

          {recommendations.length > 0 && (
            <Panel>
              <SectionHeader title="Executive Recommendations" sub="AI-assisted security guidance" />
              <ol className="space-y-2.5">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex gap-3 text-xs font-mono">
                    <span className="w-5 text-right font-bold" style={{ color: 'var(--accent)' }}>{idx + 1}.</span>
                    <p style={{ color: 'var(--tx-2)' }}>{rec}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}
