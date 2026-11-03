// Evee - Server-Side Request Forgery (SSRF) Protection & DNS-Rebinding Immune Fetch
// Validates URLs and destination IP addresses, pins resolved IP to prevent TOCTOU DNS rebinding,
// and enforces strict manual redirect validation.

import dns from 'dns/promises';
import net from 'net';
import http from 'http';
import https from 'https';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set([80, 443, '']);

/**
 * Checks if an IPv4 address is in a private, loopback, link-local, carrier-grade NAT, or cloud metadata range.
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP treated as dangerous
  }

  const [a, b] = parts;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private network)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private network)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local, AWS/GCP/Azure instance metadata)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

/**
 * Checks if an IPv6 address is private, loopback, link-local, unique local, or IPv4-mapped private.
 */
export function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  // Loopback / unspecified
  if (lower === '::1' || lower === '::') {
    return true;
  }

  // IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1, ::ffff:169.254.169.254)
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice(7);
    if (net.isIPv4(v4)) {
      return isPrivateIPv4(v4);
    }
    return true;
  }

  // Link-local / Unique local (fe80::/10, fc00::/7)
  if (
    lower.startsWith('fe80:') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') ||
    lower.startsWith('fc00:') ||
    lower.startsWith('fd00:') ||
    lower.startsWith('fc') ||
    lower.startsWith('fd')
  ) {
    return true;
  }

  return false;
}

export function isPrivateIP(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // Malformed / non-IP
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

export interface SafeFetchResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  finalUrl: string;
}

/**
 * Executes an HTTP GET request with IP Pinning and manual redirect validation.
 * Defeats TOCTOU DNS Rebinding attacks by pinning the socket lookup directly to the validated IP.
 */
export async function safeHttpRequest(
  initialUrl: string,
  options: {
    timeoutMs?: number;
    maxRedirects?: number;
    maxBodySizeBytes?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<SafeFetchResponse> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxRedirects = options.maxRedirects ?? 3;
  const maxBodySizeBytes = options.maxBodySizeBytes ?? 1500000;

  let currentUrl = initialUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    const ssrfCheck = await validateUrlAgainstSSRF(currentUrl);
    if (!ssrfCheck.isValid || !ssrfCheck.resolvedIp || !ssrfCheck.url) {
      throw new Error(`SSRF blocked: ${ssrfCheck.reason || 'Invalid URL'}`);
    }

    const pinnedIp = ssrfCheck.resolvedIp;
    const parsedUrl = ssrfCheck.url;
    const isHttps = parsedUrl.protocol === 'https:';
    const httpLib = isHttps ? https : http;

    // Pin DNS lookup directly to the validated IP - eliminates DNS rebinding
    const pinnedLookup = (
      _hostname: string,
      _opts: any,
      callback: (err: Error | null, address: string, family: number) => void
    ) => {
      const family = net.isIP(pinnedIp);
      callback(null, pinnedIp, family || 4);
    };

    const agent = isHttps
      ? new https.Agent({ lookup: pinnedLookup, keepAlive: false })
      : new http.Agent({ lookup: pinnedLookup, keepAlive: false });

    const reqHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; EveeBot/1.0; +https://evee.local/bot)',
      Accept: 'text/html,application/xhtml+xml',
      Host: parsedUrl.host,
      ...(options.headers || {}),
    };

    const response = await new Promise<SafeFetchResponse>((resolve, reject) => {
      let isSettled = false;

      const req = httpLib.request(
        parsedUrl,
        {
          agent,
          method: 'GET',
          headers: reqHeaders,
          timeout: timeoutMs,
          ...(isHttps ? { servername: parsedUrl.hostname } : {}),
        },
        (res) => {
          const chunks: Buffer[] = [];
          let totalBytes = 0;

          res.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length;
            if (totalBytes <= maxBodySizeBytes) {
              chunks.push(chunk);
            } else {
              if (!isSettled) {
                isSettled = true;
                req.destroy();
                resolve({
                  statusCode: res.statusCode || 200,
                  headers: res.headers as any,
                  body: Buffer.concat(chunks).toString('utf-8'),
                  finalUrl: currentUrl,
                });
              }
            }
          });

          res.on('end', () => {
            if (!isSettled) {
              isSettled = true;
              resolve({
                statusCode: res.statusCode || 200,
                headers: res.headers as any,
                body: Buffer.concat(chunks).toString('utf-8'),
                finalUrl: currentUrl,
              });
            }
          });

          res.on('error', (err) => {
            if (!isSettled) {
              isSettled = true;
              reject(err);
            }
          });
        }
      );

      req.on('timeout', () => {
        if (!isSettled) {
          isSettled = true;
          req.destroy();
          reject(new Error(`Request timed out after ${timeoutMs}ms`));
        }
      });

      req.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      });

      req.end();
    });

    // Check for 3xx redirects
    if (
      response.statusCode >= 300 &&
      response.statusCode < 400 &&
      response.headers.location
    ) {
      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new Error(`Too many redirects (limit: ${maxRedirects})`);
      }

      const redirectLocation = Array.isArray(response.headers.location)
        ? response.headers.location[0]
        : response.headers.location;

      currentUrl = new URL(redirectLocation, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new Error('Unexpected redirect loop termination');
}
