/**
 * IP address validation utilities.
 *
 * Used by the Threat Intelligence page to gate API calls.
 * The backend should also validate; this is a UX-layer guard only.
 */

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

// Simplified but practical IPv6 check (full RFC-3513 parsing not required here)
const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}?)$/;

export function isValidIPv4(ip: string): boolean {
  if (!IPV4_RE.test(ip)) return false;
  return ip.split('.').map(Number).every(octet => octet >= 0 && octet <= 255);
}

export function isValidIPv6(ip: string): boolean {
  return IPV6_RE.test(ip);
}

export function isValidIP(ip: string): boolean {
  const trimmed = ip.trim();
  return isValidIPv4(trimmed) || isValidIPv6(trimmed);
}

export const IP_VALIDATION_ERROR =
  'Invalid IP address.\nPlease enter a valid IPv4 or IPv6 address.';
