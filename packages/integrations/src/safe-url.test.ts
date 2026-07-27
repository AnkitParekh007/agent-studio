import { describe, expect, it } from 'vitest';
import { assertSafeOutboundUrl } from './safe-url.js';

describe('assertSafeOutboundUrl', () => {
  it('allows public https and http targets', () => {
    expect(assertSafeOutboundUrl('https://docs.example.com/a?b=1').hostname).toBe(
      'docs.example.com',
    );
    expect(assertSafeOutboundUrl('http://example.org').protocol).toBe('http:');
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => assertSafeOutboundUrl('file:///etc/passwd')).toThrow(/http\(s\)/);
    expect(() => assertSafeOutboundUrl('not a url')).toThrow(/Invalid URL/);
  });

  it('enforces https when required', () => {
    expect(() =>
      assertSafeOutboundUrl('http://example.com', { requireHttps: true }),
    ).toThrow(/HTTPS is required/);
  });

  it.each([
    'http://localhost:8080',
    'http://api.localhost',
    'http://db.internal',
    'http://printer.local',
    'http://metadata.google.internal/computeMetadata/v1/',
  ])('rejects internal hostname %s', (url) => {
    expect(() => assertSafeOutboundUrl(url)).toThrow(/not allowed/);
  });

  it.each([
    'http://127.0.0.1',
    'http://10.1.2.3',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.64.0.1',
    'http://0.0.0.0',
  ])('rejects private IPv4 %s', (url) => {
    expect(() => assertSafeOutboundUrl(url)).toThrow(/not allowed/);
  });

  it.each(['http://[::1]', 'http://[fc00::1]', 'http://[fd00::1]', 'http://[fe80::1]'])(
    'rejects private IPv6 %s',
    (url) => {
      expect(() => assertSafeOutboundUrl(url)).toThrow(/not allowed/);
    },
  );

  it('allows public IPv4 and IPv6 literals', () => {
    expect(assertSafeOutboundUrl('http://8.8.8.8').hostname).toBe('8.8.8.8');
    expect(assertSafeOutboundUrl('http://[2606:4700::1111]').protocol).toBe('http:');
  });
});
