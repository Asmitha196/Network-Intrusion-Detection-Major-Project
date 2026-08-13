import type { ReactNode, CSSProperties } from 'react';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/* ─────────────────────────────────────────
   Severity badge
───────────────────────────────────────── */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, { bg: string; text: string; border: string }> = {
    CRITICAL: { bg: 'var(--crit-dim)',  text: 'var(--crit)',  border: 'var(--crit-border)'  },
    HIGH:     { bg: 'var(--high-dim)',  text: 'var(--high)',  border: 'var(--high-border)'  },
    MEDIUM:   { bg: 'var(--med-dim)',   text: 'var(--med)',   border: 'var(--med-border)'   },
    LOW:      { bg: 'var(--low-dim)',   text: 'var(--low)',   border: 'var(--low-border)'   },
  };
  const c = map[severity];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: c.text }} />
      {severity}
    </span>
  );
}

/* ─────────────────────────────────────────
   Panel
───────────────────────────────────────── */
export function Panel({
  children, className = '', style, noPad,
}: {
  children: ReactNode; className?: string; style?: CSSProperties; noPad?: boolean;
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: noPad ? 0 : '1.1rem 1.25rem',
        transition: 'background 0.2s, border-color 0.2s',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────
   Stat card
───────────────────────────────────────── */
export function StatCard({
  label, value, sub, accent = false, critical = false, large = false,
}: {
  label: string; value: string | number; sub?: string;
  accent?: boolean; critical?: boolean; large?: boolean;
}) {
  const barColor   = critical ? 'var(--crit)'   : accent ? 'var(--accent)'   : 'transparent';
  const valColor   = critical ? 'var(--crit)'   : accent ? 'var(--accent)'   : 'var(--tx-1)';
  const bdColor    = critical ? 'var(--crit-border)' : accent ? 'var(--accent-border)' : 'var(--border)';
  const glowColor  = critical ? 'rgba(239,68,68,0.35)' : accent ? 'rgba(0,242,254,0.25)' : 'none';
  const cornerBg   = critical ? 'radial-gradient(circle at top right, rgba(239,68,68,0.06) 0%, transparent 70%)'
                   : accent   ? 'radial-gradient(circle at top right, rgba(0,242,254,0.06) 0%, transparent 70%)'
                   : 'none';
  return (
    <div
      style={{ position: 'relative', background: 'var(--surface)', border: `1px solid ${bdColor}`,
               borderRadius: 10, padding: '1rem 1.1rem 1rem 1.3rem', overflow: 'hidden',
               transition: 'background 0.15s, border-color 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
    >
      {/* Left bar */}
      <div style={{ position: 'absolute', left: 0, top: '16%', bottom: '16%', width: 2,
                    borderRadius: 99, background: barColor,
                    boxShadow: (accent || critical) ? `0 0 6px ${barColor}` : 'none' }} />
      {/* Corner shimmer */}
      {(accent || critical) && (
        <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60,
                      background: cornerBg, pointerEvents: 'none' }} />
      )}
      <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--tx-5)' }}>{label}</p>
      <p className={`font-mono font-bold leading-none ${large ? 'text-3xl' : 'text-xl'}`}
        style={{ color: valColor, textShadow: (accent || critical) ? `0 0 12px ${glowColor}` : 'none' }}>
        {value}
      </p>
      {sub && <p className="text-[10.5px] font-mono mt-1.5" style={{ color: 'var(--tx-5)' }}>{sub}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────
   Section header
───────────────────────────────────────── */
export function SectionHeader({
  title, sub, children,
}: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--tx-3)' }}>{title}</h2>
        {sub && <p className="text-[10.5px] font-mono mt-0.5" style={{ color: 'var(--tx-5)' }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────
   Status badge
───────────────────────────────────────── */
export function StatusBadge({ status }: { status: 'NEW' | 'INVESTIGATING' | 'RESOLVED' }) {
  const map = {
    NEW:           { bg: 'rgba(59,130,246,0.1)',  text: 'var(--status-new)', border: 'rgba(59,130,246,0.28)' },
    INVESTIGATING: { bg: 'var(--high-dim)',        text: 'var(--status-inv)', border: 'var(--high-border)' },
    RESOLVED:      { bg: 'var(--low-dim)',         text: 'var(--status-res)', border: 'var(--low-border)' },
  };
  const c = map[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────
   IP — mono accent
───────────────────────────────────────── */
export function IP({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[12px] font-medium" style={{ color: 'var(--accent)' }}>{children}</span>
  );
}

/* ─────────────────────────────────────────
   Risk score ring
───────────────────────────────────────── */
export function RiskScore({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--crit)' : score >= 60 ? 'var(--high)' : score >= 40 ? 'var(--med)' : 'var(--low)';
  const hex   = score >= 80 ? '#EF4444' : score >= 60 ? '#F59E0B' : score >= 40 ? '#EAB308' : '#10B981';
  const circumference = 2 * Math.PI * 20;
  const dash = (score / 100) * circumference;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx="26" cy="26" r="20" fill="none" stroke="var(--border)" strokeWidth="3.5" />
      <circle cx="26" cy="26" r="20" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        style={{ filter: `drop-shadow(0 0 4px ${hex}66)` }} />
      <text x="26" y="26" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="12" fontFamily="JetBrains Mono" fontWeight="700"
        style={{ transform: 'rotate(90deg)', transformOrigin: '26px 26px' }}>
        {score}
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────
   Empty state
───────────────────────────────────────── */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14" style={{ color: 'var(--tx-5)' }}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="mb-3">
        <path d="M18 3L33 11.5V24.5L18 33L3 24.5V11.5L18 3Z" stroke="var(--border)" strokeWidth="1.5" fill="none" />
        <circle cx="18" cy="18" r="3" fill="var(--border)" />
      </svg>
      <p className="text-[12px] font-mono">{message}</p>
    </div>
  );
}

/* ─────────────────────────────────────────
   Loading
───────────────────────────────────────── */
export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="w-6 h-6 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
    </div>
  );
}

/* ─────────────────────────────────────────
   Confirm dialog
───────────────────────────────────────── */
export function ConfirmDialog({
  open, title, message, onConfirm, onCancel, danger = false,
}: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm slide-in"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)',
                 borderRadius: 14, padding: '1.5rem',
                 boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <h3 className="font-semibold mb-2 text-[15px]" style={{ color: 'var(--tx-1)' }}>{title}</h3>
        <p className="text-[13px] font-mono leading-relaxed mb-6" style={{ color: 'var(--tx-4)' }}>{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--tx-4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--tx-1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx-4)')}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
            style={danger
              ? { background: 'var(--crit-dim)',  border: '1px solid var(--crit-border)',  color: 'var(--crit)'  }
              : { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }
            }>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Table primitives
───────────────────────────────────────── */
export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {headers.map(h => (
              <th key={h}
                className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap"
                style={{ color: 'var(--tx-5)', fontFamily: 'JetBrains Mono, monospace' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="row-hover"
      style={{ borderBottom: '1px solid var(--border)', cursor: onClick ? 'pointer' : 'default', transition: 'background 0.1s' }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'var(--hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {children}
    </tr>
  );
}

export function Td({ children, mono = false, muted = false, className = '' }: {
  children: ReactNode; mono?: boolean; muted?: boolean; className?: string;
}) {
  return (
    <td
      className={`py-2.5 px-3 text-[12px] ${className}`}
      style={{
        color: muted ? 'var(--tx-4)' : 'var(--tx-2)',
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl overflow-hidden shadow-2xl z-10"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-mono font-bold" style={{ color: 'var(--tx-1)' }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
