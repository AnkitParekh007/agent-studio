import { describe, expect, it, vi } from 'vitest';
import { mcpListTools } from './mcp-client.js';

describe('mcpListTools', () => {
  it('parses tools/list JSON-RPC responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: 2, result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            result: { tools: [{ name: 'search', description: 'Search docs' }] },
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const tools = await mcpListTools({ endpointUrl: 'https://mcp.example/rpc' });
    expect(tools).toEqual([{ name: 'search', description: 'Search docs' }]);
    vi.unstubAllGlobals();
  });
});
