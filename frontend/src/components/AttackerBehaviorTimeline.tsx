import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface TimelineEventItem {
  id: string;
  timestamp: string;
  type: 'ALERT' | 'HONEYPOT' | 'INCIDENT' | 'FLOW';
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: Record<string, any>;
}

interface AttackerBehaviorTimelineProps {
  sourceIp: string;
  initialEvents?: TimelineEventItem[];
}

export const AttackerBehaviorTimeline: React.FC<AttackerBehaviorTimelineProps> = ({
  sourceIp,
  initialEvents,
}) => {
  const [events, setEvents] = useState<TimelineEventItem[]>(initialEvents || []);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(!initialEvents || initialEvents.length === 0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (sourceIp) {
      fetchTimeline();
    }
  }, [sourceIp]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/attackers/${encodeURIComponent(sourceIp)}/timeline?limit=100`);
      setEvents(res.data || []);
    } catch (err) {
      console.warn(`Failed to fetch behavior timeline for IP ${sourceIp}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filterType === 'ALL') return true;
    return ev.type === filterType;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'HONEYPOT': return '🍯';
      case 'INCIDENT': return '🛡️';
      case 'FLOW': return '🌐';
      default: return '⚡';
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL': return { bg: '#3d1419', text: '#ff7b72', border: '#7d1a24' };
      case 'HIGH': return { bg: '#362112', text: '#ffa657', border: '#844214' };
      case 'MEDIUM': return { bg: '#2b2c14', text: '#d29922', border: '#695010' };
      default: return { bg: '#16231a', text: '#56d364', border: '#1b4b27' };
    }
  };

  return (
    <div style={styles.container}>
      {/* Timeline Controls */}
      <div style={styles.controls}>
        <div style={styles.filterGroup}>
          {['ALL', 'ALERT', 'HONEYPOT', 'INCIDENT'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                ...styles.filterBtn,
                backgroundColor: filterType === type ? '#21262d' : 'transparent',
                color: filterType === type ? '#58a6ff' : '#8b949e',
                borderColor: filterType === type ? '#388bfd' : '#30363d',
              }}
            >
              {type === 'ALL' ? 'ALL EVENTS' : type + 'S'}
            </button>
          ))}
        </div>

        <button onClick={fetchTimeline} style={styles.refreshBtn}>
          🔄 Refresh Timeline
        </button>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Building Behavior Timeline for {sourceIp}...</div>
      ) : filteredEvents.length === 0 ? (
        <div style={styles.emptyBox}>No events recorded for filter '{filterType}'.</div>
      ) : (
        <div style={styles.timelineList}>
          {filteredEvents.map((item) => {
            const badge = getSeverityBadge(item.severity);
            const dateObj = new Date(item.timestamp);
            const timeStr = dateObj.toLocaleTimeString();
            const dateStr = dateObj.toLocaleDateString();
            const isExpanded = expandedId === item.id;

            return (
              <div key={item.id} style={styles.timelineCard}>
                <div style={styles.iconCol}>
                  <div style={styles.iconNode}>{getEventIcon(item.type)}</div>
                  <div style={styles.verticalLine} />
                </div>

                <div style={styles.contentCol}>
                  <div style={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={styles.titleText}>{item.title}</span>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: badge.bg,
                          color: badge.text,
                          borderColor: badge.border,
                        }}
                      >
                        {item.severity}
                      </span>
                    </div>

                    <div style={styles.timeBadge}>
                      <strong style={{ color: '#58a6ff' }}>{timeStr}</strong> ({dateStr})
                    </div>
                  </div>

                  {/* Summary row */}
                  <div style={styles.summaryRow}>
                    {item.type === 'ALERT' && (
                      <span>
                        Target: <strong style={{ color: '#58a6ff', fontFamily: 'monospace' }}>{item.details.dst_ip}:{item.details.dst_port}</strong> | Confidence: <strong>{(item.details.confidence * 100).toFixed(1)}%</strong>
                      </span>
                    )}

                    {item.type === 'HONEYPOT' && (
                      <span>
                        Service: <strong>{item.details.service}</strong> | Request: <code style={styles.codeSnippet}>{item.details.request_type}</code>
                      </span>
                    )}

                    {item.type === 'INCIDENT' && (
                      <span>
                        Risk Score: <strong style={{ color: '#ff7b72' }}>{item.details.risk_score}/100</strong> | Status: <strong>{item.details.status}</strong> | Linked Alerts: <strong>{item.details.alert_count}</strong>
                      </span>
                    )}
                  </div>

                  {/* Toggle details */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    style={styles.toggleBtn}
                  >
                    {isExpanded ? '▲ Hide Payload' : '▼ Inspect Raw Details'}
                  </button>

                  {isExpanded && (
                    <pre style={styles.jsonPayload}>
                      {JSON.stringify(item.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' },
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' },
  filterGroup: { display: 'flex', gap: '6px' },
  filterBtn: { border: '1px solid #30363d', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' },
  refreshBtn: { backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' },
  timelineList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  timelineCard: { display: 'flex', gap: '12px' },
  iconCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '32px' },
  iconNode: { fontSize: '16px', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  verticalLine: { width: '2px', backgroundColor: '#21262d', flex: 1, marginTop: '4px' },
  contentCol: { flex: 1, backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '12px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' },
  titleText: { fontSize: '13px', fontWeight: 600, color: '#f0f6fc' },
  badge: { fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', border: '1px solid' },
  timeBadge: { fontSize: '11px', color: '#8b949e' },
  summaryRow: { fontSize: '12px', color: '#8b949e', marginBottom: '8px' },
  codeSnippet: { backgroundColor: '#0d1117', padding: '2px 6px', borderRadius: '4px', color: '#ffa657', fontSize: '11px' },
  toggleBtn: { background: 'none', border: 'none', color: '#58a6ff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 },
  jsonPayload: { backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '10px', fontSize: '11px', color: '#79c0ff', overflowX: 'auto', marginTop: '8px' },
  loadingBox: { padding: '24px', textAlign: 'center', color: '#8b949e', fontSize: '13px' },
  emptyBox: { padding: '24px', textAlign: 'center', color: '#8b949e', fontSize: '13px' },
};
