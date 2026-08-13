import { useState } from 'react'
import { Search, AlertTriangle, CheckCircle } from 'lucide-react'
import apiClient from '../api/client'
import { Panel, SectionHeader } from '../components/ui'
import type { ThreatIntelData } from '../types'

const SAMPLE_IPS = ['185.220.101.5', '8.8.8.8', '1.1.1.1', '192.168.1.1']

function isValidIP(ip: string): boolean {
  const clean = ip.trim()
  if (!clean) return false

  // Validate IPv4
  const v4Parts = clean.split('.')
  if (v4Parts.length === 4) {
    return v4Parts.every(part => {
      if (!/^\d+$/.test(part)) return false
      const num = Number(part)
      return num >= 0 && num <= 255
    })
  }

  // Validate IPv6
  const v6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){1,7}:|:((:[0-9a-fA-F]{1,4}){1,7}|:))$|^::1$/
  return v6Regex.test(clean)
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: color, boxShadow: `0 0 4px ${color}66` }} />
      </div>
      <span className="text-[11px] font-mono w-8 text-right" style={{ color }}>{value}</span>
    </div>
  )
}

export default function ThreatIntelPage() {
  const [query, setQuery] = useState<string>('185.220.101.5')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<ThreatIntelData | null>(null)

  const lookup = async (ipToSearch: string) => {
    const cleanIp = ipToSearch.trim()

    if (!isValidIP(cleanIp)) {
      setError('Invalid IP address. Please enter a valid IPv4 or IPv6 address.')
      setResult(null)
      return
    }

    setError('')
    setLoading(true)
    setResult(null)

    try {
      // Calling exact endpoint GET /threat-intel/lookup/{ip_address}
      const res = await apiClient.get<ThreatIntelData>(`/threat-intel/lookup/${encodeURIComponent(cleanIp)}`)
      setResult(res.data)
    } catch (err: any) {
      console.error(`Failed to lookup IP ${cleanIp}:`, err)
      const detail = err.response?.data?.detail
      if (detail) {
        setError(typeof detail === 'string' ? detail : JSON.stringify(detail))
      } else {
        setError('Invalid IP address. Please enter a valid IPv4 or IPv6 address.')
      }
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    lookup(query)
  }

  const isMalicious = result?.known_malicious ?? ((result?.abuse_score ?? 0) > 50)

  return (
    <div className="space-y-5 max-w-3xl select-none">
      <Panel>
        <SectionHeader title="Threat Intelligence" sub="IP reputation, ASN geolocation, and threat categorization lookup" />

        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--tx-4)' }} />
            <input
              className="w-full text-[13px] font-mono pl-9 pr-4 py-2.5 rounded-lg outline-none transition-colors"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--tx-1)',
              }}
              placeholder="Enter IPv4 or IPv6 address…"
              value={query}
              onChange={e => { setQuery(e.target.value); setError('') }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent-border)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-lg text-[13px] font-mono font-medium transition-colors"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Lookup
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mb-1">
          <span className="text-[11px] font-mono" style={{ color: 'var(--tx-5)' }}>Quick samples:</span>
          {SAMPLE_IPS.map(ip => (
            <button
              key={ip}
              onClick={() => { setQuery(ip); lookup(ip) }}
              className="text-[11px] font-mono transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              {ip}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 p-3.5 rounded-lg" style={{ background: 'var(--crit-dim)', border: '1px solid var(--crit-border)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} style={{ color: 'var(--crit)' }} />
              <p className="text-[13px] font-mono font-semibold" style={{ color: 'var(--crit)' }}>{error}</p>
            </div>
          </div>
        )}
      </Panel>

      {loading && (
        <Panel style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
          <div className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          <span className="ml-3 text-[13px] font-mono" style={{ color: 'var(--tx-4)' }}>Querying threat intelligence database…</span>
        </Panel>
      )}

      {result && !loading && (
        <Panel style={{ border: `2px solid ${isMalicious ? 'var(--crit-border)' : 'var(--low-border)'}` }}>
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: isMalicious ? 'var(--crit-dim)' : 'var(--low-dim)' }}>
              {isMalicious
                ? <AlertTriangle size={22} style={{ color: 'var(--crit)' }} />
                : <CheckCircle size={22} style={{ color: 'var(--low)' }} />
              }
            </div>
            <div>
              <p className="font-mono text-xl font-bold" style={{ color: 'var(--accent)' }}>{result.ip}</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold mt-1"
                style={isMalicious
                  ? { background: 'var(--crit-dim)', border: '1px solid var(--crit-border)', color: 'var(--crit)' }
                  : { background: 'var(--low-dim)',  border: '1px solid var(--low-border)',  color: 'var(--low)'  }
                }>
                {isMalicious ? '⚠ KNOWN MALICIOUS THREAT' : '✓ CLEAN / TRUSTED HOST'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
            {[
              ['IP Address', result.ip],
              ['Country', result.country || 'N/A'],
              ['City', result.city || 'N/A'],
              ['ASN', result.asn || 'N/A'],
              ['ISP', result.isp || 'N/A'],
              ['Threat Category', result.threat_category || 'N/A'],
              ['IP Type', result.is_private ? 'Private (RFC1918)' : 'Public Internet IP'],
              ['Latitude', typeof result.latitude === 'number' ? result.latitude.toFixed(4) : 'N/A'],
              ['Longitude', typeof result.longitude === 'number' ? result.longitude.toFixed(4) : 'N/A'],
            ].map(([k, v]) => (
              <div key={k as string}>
                <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--tx-5)' }}>{k}</p>
                <p className="text-[12px] font-mono font-medium" style={{ color: 'var(--tx-2)' }}>{v}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span style={{ color: 'var(--tx-4)' }}>Abuse Score</span>
                <span style={{ color: 'var(--crit)' }}>{result.abuse_score}%</span>
              </div>
              <Bar value={result.abuse_score} color={isMalicious ? 'var(--crit)' : 'var(--low)'} />
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span style={{ color: 'var(--tx-4)' }}>Reputation Score</span>
                <span style={{ color: 'var(--low)' }}>{result.reputation_score}/100</span>
              </div>
              <Bar value={result.reputation_score} color="var(--low)" />
            </div>
          </div>
        </Panel>
      )}
    </div>
  )
}
