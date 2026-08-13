import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChevronRight, Activity, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const routeLabels: Record<string, string> = {
  '/': 'SOC Dashboard',
  '/correlated-incidents': 'Correlated Incidents',
  '/attackers': 'Attacker Profiles',
  '/honeypot': 'Honeypot Decoy',
  '/threat-intel': 'Threat Intelligence',
  '/incident': 'Incident Response',
  '/simulation': 'Simulation Lab',
  '/evaluation': 'Model Evaluation',
  '/analytics': 'Analytics',
  '/reports': 'SOC Reports',
  '/alerts': 'Alerts',
  '/traffic': 'Live Traffic',
  '/replay': 'PCAP Replay',
  '/metrics': 'Health & Metrics',
  '/settings': 'Settings',
};

interface HeaderProps { systemHealthy: boolean; }

export default function FigmaHeader({ systemHealthy }: HeaderProps) {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const pageLabel = routeLabels[pathname] ?? 'Enterprise SOC';
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const utcStr = time.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  return (
    <header
      className="h-11 flex items-center justify-between px-5 shrink-0 select-none"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(8px)',
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono tracking-widest uppercase" style={{ color: 'var(--tx-5)' }}>SOC</span>
        <ChevronRight size={11} style={{ color: 'var(--border)' }} />
        <span className="text-[13px] font-semibold tracking-wide" style={{ color: 'var(--tx-1)' }}>{pageLabel}</span>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* UTC clock */}
        <span className="hidden md:block text-[11px] font-mono tabular-nums" style={{ color: 'var(--tx-5)' }}>
          {utcStr}
        </span>

        <div className="h-4 w-px" style={{ background: 'var(--border)' }} />

        {/* Health pill */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold tracking-widest"
          style={systemHealthy ? {
            background: 'var(--low-dim)',
            border: '1px solid var(--low-border)',
            color: 'var(--low)',
          } : {
            background: 'var(--crit-dim)',
            border: '1px solid var(--crit-border)',
            color: 'var(--crit)',
          }}
        >
          <Activity size={9} />
          {systemHealthy ? 'HEALTHY' : 'DEGRADED'}
        </div>

        <div className="h-4 w-px" style={{ background: 'var(--border)' }} />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="theme-toggle"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark'
            ? <Sun size={14} />
            : <Moon size={14} />
          }
        </button>
      </div>
    </header>
  );
}
