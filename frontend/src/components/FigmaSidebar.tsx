import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, GitMerge, Users, Bug, Globe2, Zap, FlaskConical,
  BarChart2, PieChart, FileBarChart, Bell, Waves, HardDriveUpload,
  Activity, SlidersHorizontal, Wifi, WifiOff, Loader2, ChevronRight,
} from 'lucide-react';

type WsStatus = 'connected' | 'disconnected' | 'connecting';
interface SidebarProps { wsStatus: WsStatus; }

const groups = [
  {
    label: 'Operations',
    items: [
      { path: '/',                    label: 'SOC Dashboard',        icon: LayoutDashboard },
      { path: '/correlated-incidents', label: 'Correlated Incidents', icon: GitMerge },
      { path: '/attackers',           label: 'Attacker Profiles',    icon: Users },
      { path: '/honeypot',            label: 'Honeypot Decoy',       icon: Bug },
      { path: '/threat-intel',        label: 'Threat Intelligence',  icon: Globe2 },
      { path: '/incident',            label: 'Incident Response',    icon: Zap },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { path: '/simulation', label: 'Simulation Lab',   icon: FlaskConical },
      { path: '/evaluation', label: 'Model Evaluation', icon: BarChart2 },
      { path: '/analytics',  label: 'Analytics',        icon: PieChart },
      { path: '/reports',    label: 'SOC Reports',      icon: FileBarChart },
    ],
  },
  {
    label: 'Network',
    items: [
      { path: '/alerts',  label: 'Alerts',       icon: Bell },
      { path: '/traffic', label: 'Live Traffic', icon: Waves },
      { path: '/replay',  label: 'PCAP Replay',  icon: HardDriveUpload },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/metrics',  label: 'Health & Metrics', icon: Activity },
      { path: '/settings', label: 'Settings',         icon: SlidersHorizontal },
    ],
  },
];

const wsConfig: Record<WsStatus, { color: string; label: string; ring: string }> = {
  connected:    { color: '#10b981', label: 'Stream Connected',    ring: 'rgba(16,185,129,0.28)' },
  disconnected: { color: '#ef4444', label: 'Stream Disconnected', ring: 'rgba(239,68,68,0.28)'  },
  connecting:   { color: '#f59e0b', label: 'Connecting…',         ring: 'rgba(245,158,11,0.28)' },
};

export default function FigmaSidebar({ wsStatus }: SidebarProps) {
  const location = useLocation();
  const ws = wsConfig[wsStatus];

  return (
    <aside
      className="flex flex-col w-56 min-h-screen shrink-0 relative"
      style={{
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      {/* Subtle right-edge accent glow */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-px"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, var(--accent-border) 40%, var(--accent-dim) 60%, transparent 100%)',
          opacity: 0.6,
        }}
      />

      {/* ── Brand ── */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-1.5">
          {/* Hex mark */}
          <div className="relative shrink-0">
            <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
              <path d="M14 1L26.856 8V24L14 31L1.144 24V8L14 1Z"
                fill="var(--accent-dim)" stroke="var(--accent-border)" strokeWidth="1.2" />
              <path d="M14 7L22 12V20L14 25L6 20V12L14 7Z"
                fill="var(--accent-dim)" />
              <circle cx="14" cy="16" r="2.8" fill="var(--accent)" opacity="0.9" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[12.5px] tracking-[0.06em] leading-tight" style={{ color: 'var(--tx-1)' }}>
              ENTERPRISE SOC
            </p>
            <p className="text-[9px] font-mono tracking-[0.16em] uppercase mt-0.5" style={{ color: 'var(--accent)', opacity: 0.65 }}>
              Dual-Stage NIDS
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        {groups.map(group => (
          <div key={group.label}>
            <p className="px-5 mb-1 text-[9px] font-semibold tracking-[0.2em] uppercase"
              style={{ color: 'var(--tx-5)' }}>
              {group.label}
            </p>
            {group.items.map(({ path, label, icon: Icon }) => {
              const active = path === '/'
                ? location.pathname === '/'
                : location.pathname === path || location.pathname.startsWith(path + '/');
              return (
                <NavLink
                  key={path}
                  to={path}
                  className="relative flex items-center gap-2.5 mx-3 px-3 py-[7px] rounded-lg text-[13px] transition-all duration-150 select-none"
                  style={active ? {
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                    fontWeight: 500,
                  } : {
                    color: 'var(--tx-4)',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      const el = e.currentTarget as HTMLElement;
                      el.style.color = 'var(--tx-2)';
                      el.style.background = 'var(--hover)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      const el = e.currentTarget as HTMLElement;
                      el.style.color = 'var(--tx-4)';
                      el.style.background = 'transparent';
                    }
                  }}
                >
                  {/* Active left bar */}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full"
                      style={{ height: '55%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
                  )}
                  <Icon size={13} />
                  <span className="flex-1 leading-none">{label}</span>
                  {active && <ChevronRight size={10} style={{ color: 'var(--accent)', opacity: 0.5 }} />}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── WebSocket status ── */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
            {wsStatus === 'connected' && (
              <span className="absolute w-3.5 h-3.5 rounded-full"
                style={{ background: ws.ring, animation: 'pulse-ring 2s ease-out infinite' }} />
            )}
            {wsStatus === 'connecting'
              ? <Loader2 size={10} style={{ color: ws.color }} className="animate-spin" />
              : wsStatus === 'connected'
                ? <Wifi size={10} style={{ color: ws.color }} />
                : <WifiOff size={10} style={{ color: ws.color }} />
            }
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono font-medium leading-tight truncate" style={{ color: ws.color }}>
              {ws.label}
            </p>
            <p className="text-[9.5px] font-mono leading-tight mt-0.5 truncate" style={{ color: 'var(--tx-5)' }}>
              ws://127.0.0.1:8000/ws
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
