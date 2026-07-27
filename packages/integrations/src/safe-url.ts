/**
 * Block private/link-local/metadata targets and non-http(s) URLs.
 * Used by knowledge fetch and MCP client (SSRF mitigation).
 */
export function assertSafeOutboundUrl(raw: string, options?: { requireHttps?: boolean }): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  if (options?.requireHttps && url.protocol !== 'https:') {
    throw new Error('HTTPS is required');
  }

  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('Host is not allowed');
  }

  // IPv6 literals
  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1).toLowerCase();
    if (
      inner === '::1' ||
      inner.startsWith('fc') ||
      inner.startsWith('fd') ||
      inner.startsWith('fe80')
    ) {
      throw new Error('Private IPv6 address is not allowed');
    }
  }

  // IPv4 dotted-quad (also reject decimal/octal obfuscation by requiring plain form)
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) throw new Error('Invalid IPv4 address');
    const [a, b] = parts;
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b !== undefined && b >= 64 && b <= 127)
    ) {
      throw new Error('Private or link-local IPv4 address is not allowed');
    }
  }

  return url;
}
