// Evee - Server-Side Request Forgery (SSRF) Protection
// Validates URLs and destination IP addresses before any external research fetch

import dns from 'dns/promises';
import net from 'net';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set([80, 443, '']);

/**
 * Checks if an IPv4 address is in a private, loopback, link-local, or cloud metadata range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP treated as dangerous
  }

  const [a, b] = parts;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private network)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private network: 172.16.x.x - 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private network)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local, AWS/GCP/Azure instance metadata)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

/**
 * Checks if an IPv6 address is private, loopback, link-local or unique local.
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
    return true;
  }
  return false;
}

export interface SSRFValidationResult {
  isValid: boolean;
  reason?: string;
  resolvedIp?: string;
  url?: URL;
}

/**
 * Validates a target URL against SSRF attacks:
 * 1. Checks protocol (only http and https allowed)
 * 2. Checks port (only 80 and 443 allowed)
 * 3. Resolves DNS to IP addresses
 * 4. Verifies no resolved IP belongs to a private/reserved/cloud metadata subnet
 */
export async function validateUrlAgainstSSRF(urlString: string): Promise<SSRFValidationResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { isValid: false, reason: 'Invalid URL format' };
  }

  // 1. Check protocol
  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    return { isValid: false, reason: `Disallowed protocol: ${parsedUrl.protocol}` };
  }

  // 2. Check port
  if (!ALLOWED_PORTS.has(parsedUrl.port)) {
    return { isValid: false, reason: `Disallowed port: ${parsedUrl.port}` };
  }

  const hostname = parsedUrl.hostname;

  // Reject localhost or metadata domain aliases directly
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    return { isValid: false, reason: 'Hostname is a blocked internal target' };
  }

  // Check if hostname is directly an IP
  const ipType = net.isIP(hostname);
  if (ipType === 4) {
    if (isPrivateIPv4(hostname)) {
      return { isValid: false, reason: 'Destination IPv4 address is in a private or metadata range', resolvedIp: hostname };
    }
    return { isValid: true, resolvedIp: hostname, url: parsedUrl };
  } else if (ipType === 6) {
    if (isPrivateIPv6(hostname)) {
      return { isValid: false, reason: 'Destination IPv6 address is in a private or link-local range', resolvedIp: hostname };
    }
    return { isValid: true, resolvedIp: hostname, url: parsedUrl };
  }

  // Resolve DNS to verify all returned IPs
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { isValid: false, reason: 'Failed to resolve hostname' };
    }

    for (const addr of addresses) {
      if (addr.family === 4 && isPrivateIPv4(addr.address)) {
        return {
          isValid: false,
          reason: `Resolved IPv4 (${addr.address}) is in a private or restricted subnet`,
          resolvedIp: addr.address,
        };
      }
      if (addr.family === 6 && isPrivateIPv6(addr.address)) {
        return {
          isValid: false,
          reason: `Resolved IPv6 (${addr.address}) is in a private or restricted subnet`,
          resolvedIp: addr.address,
        };
      }
    }

    return { isValid: true, resolvedIp: addresses[0].address, url: parsedUrl };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'DNS lookup error';
    return { isValid: false, reason: `DNS lookup failed: ${message}` };
  }
}
