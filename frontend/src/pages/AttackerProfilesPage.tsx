import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AttackerProfile } from '../types';
import { AttackerBehaviorTimeline } from '../components/AttackerBehaviorTimeline';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const AttackerProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<AttackerProfile[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [activeProfile, setActiveProfile] = useState<AttackerProfile | null>(null);
  const [searchInput, setSearchInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTopProfiles();
  }, []);

  const fetchTopProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/attackers?limit=50`);
      setProfiles(response.data || []);
      if (response.data && response.data.length > 0) {
        handleSelectIp(response.data[0].source_ip);
      }
    } catch (err: any) {
      console.error('Failed to fetch attacker profiles:', err);
      setError('Failed to load attacker profiles. Please verify backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectIp = async (ip: string) => {
    setSelectedIp(ip);
    setProfileLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/attackers/${encodeURIComponent(ip)}`);
      setActiveProfile(response.data);
    } catch (err) {
      console.error(`Failed to fetch profile for IP ${ip}:`, err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      handleSelectIp(searchInput.trim());
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return { bg: '#3d1419', text: '#ff7b72', border: '#7d1a24' };
      case 'HIGH': return { bg: '#362112', text: '#ffa657', border: '#844214' };
      case 'MEDIUM': return { bg: '#2b2c14', text: '#d29922', border: '#695010' };
      default: return { bg: '#16231a', text: '#56d364', border: '#1b4b27' };
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Threat Actor Profiles</h1>
          <p style={styles.subtitle}>
            Aggregated threat intelligence, attack metrics, and Honeypot decoy correlations per source IP
          </p>
        </div>

        {/* IP Search Bar */}
        <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
          <input
            type="text"
            placeholder="Lookup Source IP (e.g. 192.168.1.100)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={styles.searchInput}
          />
          <button type="submit" style={styles.searchBtn}>
            Inspect Profile
          </button>
        </form>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading Attacker Profiles...</div>
      ) : error ? (
        <div style={styles.errorBox}>{error}</div>
      ) : (
        <div style={styles.grid}>
          {/* Sidebar: Top Attacker List */}
          <div style={styles.sidebar}>
            <h3 style={styles.sidebarTitle}>Top Suspicious Source IPs ({profiles.length})</h3>
            <div style={styles.profileList}>
              {profiles.length === 0 ? (
                <div style={styles.emptyText}>No suspicious IPs recorded yet.</div>
              ) : (
                profiles.map((p) => {
                  const isSelected = p.source_ip === selectedIp;
                  const badge = getRiskBadgeColor(p.risk_level);
                  return (
                    <div
                      key={p.source_ip}
                      onClick={() => handleSelectIp(p.source_ip)}
                      style={{
                        ...styles.profileCard,
                        borderColor: isSelected ? '#58a6ff' : '#30363d',
                        backgroundColor: isSelected ? '#1c2128' : '#161b22',
                      }}
                    >
                      <div style={styles.cardHeader}>
                        <span style={styles.cardIp}>{p.source_ip}</span>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: badge.bg,
                            color: badge.text,
                            borderColor: badge.border,
                          }}
                        >
                          {p.risk_level} ({p.risk_score})
                        </span>
                      </div>
                      <div style={styles.cardMetrics}>
                        <span>Alerts: <strong>{p.total_alerts}</strong></span>
                        <span>Decoy Hits: <strong>{p.honeypot_interactions}</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Main Detail View */}
          <div style={styles.mainContent}>
            {profileLoading ? (
              <div style={styles.loadingBox}>Building Threat Profile...</div>
            ) : activeProfile ? (
              <div>
                {/* Profile Title Banner */}
                <div style={styles.banner}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h2 style={styles.bannerIp}>{activeProfile.source_ip}</h2>
                      {activeProfile.threat_intelligence?.country && (
                        <span style={styles.countryTag}>
                          🌐 {activeProfile.threat_intelligence.country} ({activeProfile.threat_intelligence.isp || 'Local'})
                        </span>
                      )}
                    </div>
                    <div style={styles.timestamps}>
                      <span>First Seen: <strong>{new Date(activeProfile.first_seen).toLocaleString()}</strong></span>
                      <span style={{ marginLeft: '16px' }}>Last Seen: <strong>{new Date(activeProfile.last_seen).toLocaleString()}</strong></span>
                    </div>
                  </div>

                  {/* Risk Score Gauge */}
                  <div style={styles.riskGaugeContainer}>
                    <div style={styles.riskScoreVal}>{activeProfile.risk_score}</div>
                    <div style={styles.riskScoreLabel}>RISK SCORE ({activeProfile.risk_level})</div>
                  </div>
                </div>

                {/* Key Metric Counters */}
                <div style={styles.metricsGrid}>
                  <div style={styles.metricCard}>
                    <div style={styles.metricVal}>{activeProfile.total_alerts}</div>
                    <div style={styles.metricLabel}>Total ML Alerts</div>
                  </div>
                  <div style={styles.metricCard}>
                    <div style={styles.metricVal}>{activeProfile.port_scan_count}</div>
                    <div style={styles.metricLabel}>Port Scans</div>
                  </div>
                  <div style={styles.metricCard}>
                    <div style={styles.metricVal}>{activeProfile.brute_force_count}</div>
                    <div style={styles.metricLabel}>Brute Force Attempts</div>
                  </div>
                  <div style={{ ...styles.metricCard, borderColor: '#d29922' }}>
                    <div style={{ ...styles.metricVal, color: '#d29922' }}>{activeProfile.honeypot_interactions}</div>
                    <div style={styles.metricLabel}>Honeypot Decoy Hits</div>
                  </div>
                </div>

                {/* Attack Types Badges */}
                <div style={styles.sectionCard}>
                  <h4 style={styles.sectionTitle}>Identified Attack Categories</h4>
                  <div style={styles.tagGroup}>
                    {activeProfile.attack_types && activeProfile.attack_types.length > 0 ? (
                      activeProfile.attack_types.map((at) => (
                        <span key={at} style={styles.attackTypeTag}>
                          {at}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#8b949e' }}>None identified yet</span>
                    )}
                  </div>
                </div>

                {/* Chronological Attacker Behavior Timeline */}
                <div style={{ marginTop: '24px' }}>
                  <h4 style={styles.sectionTitle}>Attacker Behavior Timeline</h4>
                  <AttackerBehaviorTimeline sourceIp={activeProfile.source_ip} />
                </div>
              </div>
            ) : (
              <div style={styles.loadingBox}>Select an Attacker IP from the left sidebar to view profile.</div>
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
  searchForm: { display: 'flex', gap: '8px' },
  searchInput: { backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 12px', color: '#c9d1d9', fontSize: '13px', width: '280px' },
  searchBtn: { backgroundColor: '#238636', border: 'none', borderRadius: '6px', color: '#fff', padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' },
  grid: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' },
  sidebar: { backgroundColor: '#161b22', borderRadius: '8px', border: '1px solid #30363d', padding: '16px' },
  sidebarTitle: { fontSize: '14px', fontWeight: 600, color: '#f0f6fc', marginBottom: '12px', marginTop: 0 },
  profileList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' },
  profileCard: { borderRadius: '6px', border: '1px solid #30363d', padding: '12px', cursor: 'pointer', transition: 'all 0.2s ease' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  cardIp: { fontFamily: 'monospace', fontWeight: 600, fontSize: '14px', color: '#58a6ff' },
  badge: { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', border: '1px solid' },
  cardMetrics: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8b949e' },
  mainContent: { backgroundColor: '#161b22', borderRadius: '8px', border: '1px solid #30363d', padding: '24px' },
  banner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d1117', padding: '20px', borderRadius: '8px', border: '1px solid #30363d', marginBottom: '24px' },
  bannerIp: { fontSize: '26px', fontWeight: 700, fontFamily: 'monospace', color: '#58a6ff', margin: 0 },
  countryTag: { fontSize: '12px', color: '#8b949e', backgroundColor: '#21262d', padding: '4px 8px', borderRadius: '4px' },
  timestamps: { fontSize: '12px', color: '#8b949e', marginTop: '8px' },
  riskGaugeContainer: { textAlign: 'center', backgroundColor: '#21262d', padding: '12px 20px', borderRadius: '8px', border: '1px solid #30363d' },
  riskScoreVal: { fontSize: '32px', fontWeight: 800, color: '#ff7b72' },
  riskScoreLabel: { fontSize: '10px', color: '#8b949e', fontWeight: 700, marginTop: '2px' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  metricCard: { backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', textAlign: 'center' },
  metricVal: { fontSize: '24px', fontWeight: 700, color: '#f0f6fc' },
  metricLabel: { fontSize: '12px', color: '#8b949e', marginTop: '4px' },
  sectionCard: { backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' },
  sectionTitle: { fontSize: '15px', fontWeight: 600, color: '#f0f6fc', margin: '0 0 12px 0' },
  tagGroup: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  attackTypeTag: { backgroundColor: '#388bfd15', color: '#58a6ff', border: '1px solid #388bfd30', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 500 },
  timeline: { display: 'flex', flexDirection: 'column', gap: '12px' },
  timelineItem: { display: 'flex', gap: '12px', backgroundColor: '#161b22', padding: '12px', borderRadius: '6px', border: '1px solid #30363d' },
  timelineIcon: { fontSize: '18px' },
  timelineHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' },
  timelineType: { fontWeight: 600, fontSize: '13px', color: '#c9d1d9' },
  timelineTime: { fontSize: '11px', color: '#8b949e' },
  timelineDetail: { fontSize: '12px', color: '#8b949e' },
  loadingBox: { padding: '40px', textAlign: 'center', color: '#8b949e', fontSize: '14px' },
  errorBox: { padding: '16px', backgroundColor: '#3d1419', color: '#ff7b72', border: '1px solid #7d1a24', borderRadius: '6px' },
  emptyText: { color: '#8b949e', fontSize: '13px', textAlign: 'center', padding: '16px' },
};
