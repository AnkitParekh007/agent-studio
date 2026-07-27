import { assertSafeOutboundUrl } from './safe-url.js';

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type McpClientOptions = {
  endpointUrl: string;
  /** Bearer token or raw Authorization header value (without "Bearer " prefix preferred). */
  authToken?: string;
  timeoutMs?: number;
  clientName?: string;
};

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

let rpcId = 1;

async function rpc<T>(
  options: McpClientOptions,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  assertSafeOutboundUrl(options.endpointUrl, { requireHttps: true });

  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };
    if (options.authToken) {
      headers.authorization = options.authToken.startsWith('Bearer ')
        ? options.authToken
        : `Bearer ${options.authToken}`;
    }

    const res = await fetch(options.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: rpcId++,
        method,
        params: params ?? {},
      }),
      signal: controller.signal,
      redirect: 'error',
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const jsonText = text.includes('data:')
      ? (text
          .split('\n')
          .find((l) => l.startsWith('data:'))
          ?.slice(5)
          .trim() ?? text)
      : text;

    const body = JSON.parse(jsonText) as JsonRpcResponse;
    if (body.error) {
      throw new Error(`MCP ${method} error: ${body.error.message}`);
    }
    return body.result as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function mcpInitialize(options: McpClientOptions): Promise<void> {
  await rpc(options, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: options.clientName ?? 'agent-studio',
      version: '0.0.1',
    },
  });
  await rpc(options, 'notifications/initialized', {}).catch(() => undefined);
}

export async function mcpListTools(options: McpClientOptions): Promise<McpTool[]> {
  await mcpInitialize(options).catch(() => undefined);
  const result = await rpc<{ tools?: McpTool[] }>(options, 'tools/list', {});
  return result.tools ?? [];
}

export async function mcpCallTool(
  options: McpClientOptions,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  await mcpInitialize(options).catch(() => undefined);
  return rpc(options, 'tools/call', { name, arguments: args });
}
