import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CorrelatedIncident } from '../types';
import { AttackerBehaviorTimeline } from '../components/AttackerBehaviorTimeline';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const CorrelatedIncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<CorrelatedIncident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<CorrelatedIncident | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchIp, setSearchIp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter]);

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE}/incidents?limit=50`;
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      if (searchIp.trim()) {
        url += `&source_ip=${encodeURIComponent(searchIp.trim())}`;
      }
      const res = await axios.get(url);
      setIncidents(res.data || []);
      if (res.data && res.data.length > 0 && !selectedIncident) {
        handleInspectIncident(res.data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to fetch correlated incidents:', err);
      setError('Failed to load correlated security incidents.');
    } finally {
      setLoading(false);
    }
  };

  const handleInspectIncident = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/incidents/${id}`);
      setSelectedIncident(res.data);
    } catch (err) {
      console.error(`Failed to fetch incident ${id}:`, err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await axios.patch(`${API_BASE}/incidents/${id}/status`, { status: newStatus });
      // Update local state
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === id ? { ...inc, status: newStatus as any } : inc))
      );
      if (selectedIncident && selectedIncident.id === id) {
        setSelectedIncident({ ...selectedIncident, status: newStatus as any });
      }
    } catch (err) {
      console.error('Failed to update incident status:', err);
      alert('Failed to update incident status');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return { bg: '#3d1419', text: '#ff7b72', border: '#7d1a24' };
      case 'INVESTIGATING': return { bg: '#362112', text: '#ffa657', border: '#844214' };
      case 'RESOLVED': return { bg: '#16231a', text: '#56d364', border: '#1b4b27' };
      default: return { bg: '#21262d', text: '#c9d1d9', border: '#30363d' };
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Correlated Security Incidents</h1>
          <p style={styles.subtitle}>
            Multi-signal incident synthesis grouping related ML alerts and Honeypot decoy events per target IP
          </p>
        </div>

        {/* Filter Bar */}
        <div style={styles.filterBar}>
          <div style={styles.tabGroup}>
            {['ALL', 'NEW', 'INVESTIGATING', 'RESOLVED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  ...styles.tabBtn,
                  backgroundColor: statusFilter === st ? '#1f242c' : 'transparent',
                  color: statusFilter === st ? '#58a6ff' : '#8b949e',
                  borderColor: statusFilter === st ? '#388bfd' : 'transparent',
                }}
              >
                {st}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search by IP..."
            value={searchIp}
            onChange={(e) => setSearchIp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchIncidents()}
            style={styles.searchInput}
          />
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading Correlated Security Incidents...</div>
      ) : error ? (
        <div style={styles.errorBox}>{error}</div>
      ) : (
        <div style={styles.grid}>
          {/* Incident List */}
          <div style={styles.sidebar}>
            <h3 style={styles.sidebarTitle}>Active Incidents ({incidents.length})</h3>
            <div style={styles.incidentList}>
              {incidents.length === 0 ? (
                <div style={styles.emptyText}>No correlated incidents found.</div>
              ) : (
                incidents.map((inc) => {
                  const isSelected = selectedIncident?.id === inc.id;
                  const badge = getStatusBadge(inc.status);
                  return (
                    <div
                      key={inc.id}
                      onClick={() => handleInspectIncident(inc.id)}
                      style={{
                        ...styles.incidentCard,
                        borderColor: isSelected ? '#58a6ff' : '#30363d',
                        backgroundColor: isSelected ? '#1c2128' : '#161b22',
                      }}
                    >
                      <div style={styles.cardHeader}>
                        <span style={styles.cardTitleText}>{inc.title}</span>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: badge.bg,
                            color: badge.text,
                            borderColor: badge.border,
                          }}
                        >
                          {inc.status}
                        </span>
                      </div>
                      <div style={styles.cardSubHeader}>
                        <span>IP: <strong style={{ fontFamily: 'monospace', color: '#58a6ff' }}>{inc.source_ip}</strong></span>
                        <span>Risk Score: <strong style={{ color: inc.risk_score >= 80 ? '#ff7b72' : '#ffa657' }}>{inc.risk_score}/100</strong></span>
                      </div>
                      <div style={styles.cardMetrics}>
                        <span>Alerts: <strong>{inc.alert_count}</strong></span>
                        <span>Decoy Hits: <strong>{inc.honeypot_interactions}</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Incident Detail Drawer */}
          <div style={styles.mainContent}>
            {detailLoading ? (
              <div style={styles.loadingBox}>Loading Incident Details...</div>
            ) : selectedIncident ? (
              <div>
                {/* Banner */}
                <div style={styles.banner}>
                  <div>
                    <h2 style={styles.bannerTitle}>{selectedIncident.title}</h2>
                    <div style={styles.bannerMeta}>
                      <span>Target IP: <strong style={{ fontFamily: 'monospace', color: '#58a6ff' }}>{selectedIncident.source_ip}</strong></span>
                      <span>Start Time: <strong>{new Date(selectedIncident.start_time).toLocaleString()}</strong></span>
                      <span>Last Activity: <strong>{new Date(selectedIncident.last_activity).toLocaleString()}</strong></span>
                    </div>
                  </div>

                  {/* Status Switcher & Risk Meter */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={styles.riskMeter}>
                      <span style={styles.riskVal}>{selectedIncident.risk_score}</span>
                      <span style={styles.riskLabel}>RISK SCORE</span>
                    </div>

                    <div style={{ marginTop: '12px' }}>
                      <label style={styles.statusSelectLabel}>Status: </label>
                      <select
                        value={selectedIncident.status}
                        onChange={(e) => handleUpdateStatus(selectedIncident.id, e.target.value)}
                        style={styles.statusSelect}
                      >
                        <option value="NEW">NEW</option>
                        <option value="INVESTIGATING">INVESTIGATING</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Attack Types */}
                <div style={styles.sectionCard}>
                  <h4 style={styles.sectionTitle}>Attack Vectors Involved</h4>
                  <div style={styles.tagGroup}>
                    {selectedIncident.attack_types && selectedIncident.attack_types.length > 0 ? (
                      selectedIncident.attack_types.map((at) => (
                        <span key={at} style={styles.attackTypeTag}>
                          ⚡ {at}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#8b949e' }}>General Anomaly</span>
                    )}
                  </div>
                </div>

                {/* Linked Alerts */}
                <div style={styles.sectionCard}>
                  <h4 style={styles.sectionTitle}>
                    Linked ML Alerts ({selectedIncident.linked_alerts?.length || 0})
                  </h4>
                  <div style={styles.alertsTableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Timestamp</th>
                          <th style={styles.th}>Stage</th>
                          <th style={styles.th}>Attack Type</th>
                          <th style={styles.th}>Severity</th>
                          <th style={styles.th}>Confidence</th>
                          <th style={styles.th}>Destination</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedIncident.linked_alerts && selectedIncident.linked_alerts.length > 0 ? (
                          selectedIncident.linked_alerts.map((al) => (
                            <tr key={al.id}>
                              <td style={styles.tdTs}>{new Date(al.timestamp).toLocaleString()}</td>
                              <td style={styles.td}>Stage {al.stage}</td>
                              <td style={styles.tdBold}>{al.attack_type || 'Anomaly'}</td>
                              <td style={styles.td}>
                                <span
                                  style={{
                                    color: al.severity === 'CRITICAL' || al.severity === 'critical' ? '#ff7b72' : '#ffa657',
                                    fontWeight: 600,
                                  }}
                                >
                                  {String(al.severity).toUpperCase()}
                                </span>
                              </td>
                              <td style={styles.td}>{(al.confidence * 100).toFixed(1)}%</td>
                              <td style={styles.tdIp}>{al.dst_ip}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} style={styles.emptyTd}>
                              No linked alerts.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Unified Attacker Behavior Timeline */}
                <div style={{ marginTop: '24px' }}>
                  <h4 style={styles.sectionTitle}>Incident Behavior Timeline</h4>
                  <AttackerBehaviorTimeline sourceIp={selectedIncident.source_ip} />
                </div>
              </div>
            ) : (
              <div style={styles.loadingBox}>Select a Correlated Incident from the left sidebar.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', backgroundColor: '#0d1117', color: '#c9d1d9', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
  title: { fontSize: '24px', fontWeight: 600, color: '#f0f6fc', margin: 0 },
  subtitle: { fontSize: '13px', color: '#8b949e', marginTop: '4px' },
  filterBar: { display: 'flex', gap: '12px', alignItems: 'center' },
  tabGroup: { display: 'flex', backgroundColor: '#161b22', borderRadius: '6px', padding: '3px', border: '1px solid #30363d' },
  tabBtn: { background: 'none', border: '1px solid transparent', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  searchInput: { backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 12px', color: '#c9d1d9', fontSize: '13px', width: '180px' },
  grid: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px' },
  sidebar: { backgroundColor: '#161b22', borderRadius: '8px', border: '1px solid #30363d', padding: '16px' },
  sidebarTitle: { fontSize: '14px', fontWeight: 600, color: '#f0f6fc', marginBottom: '12px', marginTop: 0 },
  incidentList: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' },
  incidentCard: { borderRadius: '6px', border: '1px solid #30363d', padding: '12px', cursor: 'pointer', transition: 'all 0.2s ease' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  cardTitleText: { fontSize: '13px', fontWeight: 600, color: '#f0f6fc' },
  badge: { fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', border: '1px solid' },
  cardSubHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8b949e', marginBottom: '6px' },
  cardMetrics: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8b949e' },
  mainContent: { backgroundColor: '#161b22', borderRadius: '8px', border: '1px solid #30363d', padding: '24px' },
  banner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d1117', padding: '20px', borderRadius: '8px', border: '1px solid #30363d', marginBottom: '24px' },
  bannerTitle: { fontSize: '20px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  bannerMeta: { display: 'flex', gap: '16px', fontSize: '12px', color: '#8b949e', marginTop: '8px' },
  riskMeter: { backgroundColor: '#21262d', padding: '8px 16px', borderRadius: '6px', border: '1px solid #30363d', display: 'inline-block', textAlign: 'center' },
  riskVal: { fontSize: '24px', fontWeight: 800, color: '#ff7b72' },
  riskLabel: { fontSize: '9px', fontWeight: 700, color: '#8b949e', display: 'block' },
  statusSelectLabel: { fontSize: '12px', color: '#8b949e', marginRight: '6px' },
  statusSelect: { backgroundColor: '#161b22', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' },
  sectionCard: { backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' },
  sectionTitle: { fontSize: '14px', fontWeight: 600, color: '#f0f6fc', margin: '0 0 12px 0' },
  tagGroup: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  attackTypeTag: { backgroundColor: '#388bfd15', color: '#58a6ff', border: '1px solid #388bfd30', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 500 },
  alertsTableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  th: { textAlign: 'left', padding: '8px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' },
  td: { padding: '8px 12px', borderBottom: '1px solid #21262d', color: '#c9d1d9' },
  tdTs: { padding: '8px 12px', borderBottom: '1px solid #21262d', color: '#8b949e', fontSize: '11px' },
  tdBold: { padding: '8px 12px', borderBottom: '1px solid #21262d', fontWeight: 600, color: '#f0f6fc' },
  tdIp: { padding: '8px 12px', borderBottom: '1px solid #21262d', fontFamily: 'monospace', color: '#58a6ff' },
  emptyTd: { textAlign: 'center', padding: '16px', color: '#8b949e' },
  timeline: { display: 'flex', flexDirection: 'column', gap: '8px' },
  timelineItem: { display: 'flex', gap: '10px', backgroundColor: '#161b22', padding: '10px', borderRadius: '6px', border: '1px solid #30363d' },
  timelineHeader: { display: 'flex', justifyContent: 'space-between', gap: '16px' },
  timelineType: { fontWeight: 600, fontSize: '12px', color: '#c9d1d9' },
  timelineTime: { fontSize: '11px', color: '#8b949e' },
  timelineDetail: { fontSize: '11px', color: '#8b949e', marginTop: '2px' },
  loadingBox: { padding: '40px', textAlign: 'center', color: '#8b949e', fontSize: '14px' },
  errorBox: { padding: '16px', backgroundColor: '#3d1419', color: '#ff7b72', border: '1px solid #7d1a24', borderRadius: '6px' },
  emptyText: { color: '#8b949e', fontSize: '13px', textAlign: 'center', padding: '16px' },
};
