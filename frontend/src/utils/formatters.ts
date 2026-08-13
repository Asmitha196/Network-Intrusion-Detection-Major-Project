/**
 * Display formatting utilities shared across all pages.
 */

/** Format an ISO-8601 timestamp to HH:MM:SS */
export function fmtTime(iso: string): string {
  return iso.slice(11, 19);
}

/** Format an ISO-8601 timestamp to "YYYY-MM-DD HH:MM:SS UTC" */
export function fmtDateTime(iso: string): string {
  return iso.replace('T', ' ').replace('Z', ' UTC');
}

/** Format bytes to a human-readable string */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

/** Format a 0-1 confidence value to a percentage string */
export function fmtConfidence(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Format a large number with locale separators */
export function fmtNum(value: number): string {
  return value.toLocaleString();
}

/** Format uptime in seconds to "Xd Yh Zm" */
export function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
