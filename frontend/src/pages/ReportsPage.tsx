import React, { useState } from 'react'
import apiClient from '../api/client'
import type { ReportGenerationResponse } from '../types'

export default function ReportsPage() {
  const [reportType, setReportType] = useState<string>('daily')
  const [loading, setLoading] = useState<boolean>(false)
  const [reportResult, setReportResult] = useState<ReportGenerationResponse | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await apiClient.post<ReportGenerationResponse>('/reports/generate', { report_type: reportType })
      setReportResult(res.data)
    } catch (e) {
      console.warn('Failed to generate report:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'pdf' | 'csv' | 'json') => {
    if (!reportResult?.report_id) return
    const url = `${apiClient.defaults.baseURL}/reports/${reportResult.report_id}/export?export_format=${format}`
    window.open(url, '_blank')
  }

  return (
    <div style={styles.container}>
      <div>
        <h2 style={styles.pageTitle}>Executive SOC Security Reports & Exports</h2>
        <span style={styles.pageSubtitle}>
          Generate Daily, Weekly, Monthly, or Custom SOC compliance reports and export to PDF, CSV, or JSON
        </span>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Report Configuration</h3>
        <div style={styles.row}>
          <div style={styles.selectGroup}>
            <label style={styles.label}>Select Report Time Window:</label>
            <select
              style={styles.select}
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="daily">Daily Executive Summary (Past 24h)</option>
              <option value="weekly">Weekly SOC Audit Report (Past 7 Days)</option>
              <option value="monthly">Monthly Threat Landscape Report (Past 30 Days)</option>
            </select>
          </div>

          <button style={styles.button} onClick={handleGenerate} disabled={loading}>
            {loading ? 'Compiling SOC Data...' : 'Generate Executive Report'}
          </button>
        </div>
      </div>

      {reportResult && (
        <div style={styles.card}>
          <div style={styles.reportHeader}>
            <div>
              <h3 style={styles.reportTitle}>{reportResult.report?.title}</h3>
              <span style={styles.reportMeta}>
                Generated: {new Date(reportResult.created_at).toLocaleString()} | ID: {reportResult.report_id}
              </span>
            </div>

            <div style={styles.exportButtonGroup}>
              <button style={styles.pdfBtn} onClick={() => handleExport('pdf')}>
                Export PDF
              </button>
              <button style={styles.csvBtn} onClick={() => handleExport('csv')}>
                Export CSV
              </button>
              <button style={styles.jsonBtn} onClick={() => handleExport('json')}>
                Export JSON
              </button>
            </div>
          </div>

          <div style={styles.metricsGrid}>
            <div style={styles.mBox}>
              <span style={styles.mLabel}>Total Detections</span>
              <span style={styles.mVal}>{reportResult.report?.metrics?.total_alerts}</span>
            </div>
            <div style={styles.mBox}>
              <span style={styles.mLabel}>Known Attacks</span>
              <span style={{ ...styles.mVal, color: '#3b82f6' }}>{reportResult.report?.metrics?.known_attacks}</span>
            </div>
            <div style={styles.mBox}>
              <span style={styles.mLabel}>Zero-Day Anomalies</span>
              <span style={{ ...styles.mVal, color: '#a855f7' }}>{reportResult.report?.metrics?.zero_day_anomalies}</span>
            </div>
            <div style={styles.mBox}>
              <span style={styles.mLabel}>Critical Severity</span>
              <span style={{ ...styles.mVal, color: '#ef4444' }}>{reportResult.report?.metrics?.critical_severity}</span>
            </div>
          </div>

          <div style={styles.recSection}>
            <h4 style={styles.recTitle}>SOC Action Items & Recommendations</h4>
            <ul style={styles.recList}>
              {reportResult.report?.recommendations?.map((rec: string, idx: number) => (
                <li key={idx} style={styles.recItem}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  pageTitle: { fontSize: '20px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  pageSubtitle: { fontSize: '12px', color: '#8b949e' },
  card: { backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  cardTitle: { fontSize: '15px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  row: { display: 'flex', alignItems: 'flex-end', gap: '16px' },
  selectGroup: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  label: { fontSize: '12px', color: '#8b949e', fontWeight: 600 },
  select: { backgroundColor: '#161b22', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', outline: 'none' },
  button: { backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' },
  reportHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  reportTitle: { fontSize: '18px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  reportMeta: { fontSize: '11px', color: '#8b949e' },
  exportButtonGroup: { display: 'flex', gap: '8px' },
  pdfBtn: { backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  csvBtn: { backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  jsonBtn: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
  mBox: { backgroundColor: '#161b22', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' },
  mLabel: { fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 700 },
  mVal: { fontSize: '22px', fontWeight: 700, color: '#f0f6fc' },
  recSection: { backgroundColor: '#161b22', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  recTitle: { fontSize: '13px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  recList: { margin: 0, paddingLeft: '20px', color: '#c9d1d9', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' },
  recItem: { lineHeight: 1.4 },
}
