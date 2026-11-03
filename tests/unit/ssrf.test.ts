import { describe, it, expect, vi } from 'vitest';
import dns from 'dns/promises';
import {
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateIP,
  validateUrlAgainstSSRF,
} from '@/lib/research/ssrf';

describe('SSRF Protection & Private IP Range Validation', () => {
  it('identifies private and reserved IPv4 addresses', () => {
    // Loopback
    expect(isPrivateIPv4('127.0.0.1')).toBe(true);
    expect(isPrivateIPv4('127.255.255.254')).toBe(true);

    // Private subnets (RFC 1918)
    expect(isPrivateIPv4('10.0.0.1')).toBe(true);
    expect(isPrivateIPv4('10.254.1.10')).toBe(true);
    expect(isPrivateIPv4('172.16.0.1')).toBe(true);
    expect(isPrivateIPv4('172.31.255.255')).toBe(true);
    expect(isPrivateIPv4('192.168.1.1')).toBe(true);

    // Cloud metadata & link-local (RFC 3927)
    expect(isPrivateIPv4('169.254.169.254')).toBe(true);
    expect(isPrivateIPv4('169.254.1.1')).toBe(true);

    // Carrier-Grade NAT (RFC 6598)
    expect(isPrivateIPv4('100.64.0.1')).toBe(true);
    expect(isPrivateIPv4('100.127.255.255')).toBe(true);

    // Current network & Multicast / Reserved
    expect(isPrivateIPv4('0.0.0.0')).toBe(true);
    expect(isPrivateIPv4('224.0.0.1')).toBe(true);
    expect(isPrivateIPv4('240.0.0.1')).toBe(true);

    // Public IPv4
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
    expect(isPrivateIPv4('93.184.216.34')).toBe(false);
    expect(isPrivateIPv4('172.15.0.1')).toBe(false);
    expect(isPrivateIPv4('172.32.0.1')).toBe(false);
  });

  it('identifies private, link-local, and IPv4-mapped IPv6 addresses', () => {
    // Loopback
    expect(isPrivateIPv6('::1')).toBe(true);
    expect(isPrivateIPv6('::')).toBe(true);

    // Link-local & Unique local
    expect(isPrivateIPv6('fe80::1')).toBe(true);
    expect(isPrivateIPv6('fc00::1')).toBe(true);
    expect(isPrivateIPv6('fd12:3456:789a::1')).toBe(true);

    // IPv4-mapped IPv6
    expect(isPrivateIPv6('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIPv6('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateIPv6('::ffff:10.0.0.1')).toBe(true);

    // Public IPv6
    expect(isPrivateIPv6('2001:4860:4860::8888')).toBe(false);
    expect(isPrivateIPv6('2606:4700:4700::1111')).toBe(false);
  });

  it('blocks disallowed protocols and dangerous ports', async () => {
    // Protocols
    expect((await validateUrlAgainstSSRF('file:///etc/passwd')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('gopher://127.0.0.1:70/')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('ftp://example.com/file.txt')).isValid).toBe(false);

    // Blocked ports
    expect((await validateUrlAgainstSSRF('http://93.184.216.34:22')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://93.184.216.34:25')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://93.184.216.34:3306')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://93.184.216.34:6379')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://93.184.216.34:8080')).isValid).toBe(false);

    // Allowed ports with valid public IP
    const validHttp = await validateUrlAgainstSSRF('http://93.184.216.34:80');
    expect(validHttp.isValid).toBe(true);
    const validHttps = await validateUrlAgainstSSRF('https://93.184.216.34:443');
    expect(validHttps.isValid).toBe(true);
  });

  it('blocks cloud metadata domains and internal hostnames', async () => {
    expect((await validateUrlAgainstSSRF('http://localhost/admin')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://test.localhost/')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://metadata.google.internal/computeMetadata/v1/')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://instance-data/latest/meta-data/')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://169.254.169.254/latest/meta-data/')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://127.0.0.1:80/admin')).isValid).toBe(false);
    expect((await validateUrlAgainstSSRF('http://10.0.0.5/api')).isValid).toBe(false);
  });

  it('allows safe public websites when DNS resolves to public IPs', async () => {
    // Mock dns.lookup to return a public IP deterministically
    const lookupSpy = vi.spyOn(dns, 'lookup').mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
    ] as any);

    const result = await validateUrlAgainstSSRF('https://example.com');
    expect(result.isValid).toBe(true);
    expect(result.resolvedIp).toBe('93.184.216.34');
    expect(isPrivateIP(result.resolvedIp!)).toBe(false);

    lookupSpy.mockRestore();
  });

  it('detects DNS rebinding attempt returning private IP', async () => {
    // Simulate DNS responding with private 127.0.0.1 or 169.254.169.254
    const lookupSpy = vi.spyOn(dns, 'lookup').mockResolvedValueOnce([
      { address: '169.254.169.254', family: 4 },
    ] as any);

    const result = await validateUrlAgainstSSRF('https://attacker-rebind.com');
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('private or restricted subnet');

    lookupSpy.mockRestore();
  });
});
