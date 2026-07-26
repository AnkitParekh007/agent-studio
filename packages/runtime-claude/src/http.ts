export type HttpRequest = {
  method: string;
  path: string;
  body?: unknown;
};

export type HttpResponse = {
  status: number;
  body: unknown;
};

export type ClaudeHttpClient = (request: HttpRequest) => Promise<HttpResponse>;

export function createFetchClaudeHttpClient(options: {
  apiKey: string;
  baseUrl: string;
  betaHeader?: string;
}): ClaudeHttpClient {
  const beta = options.betaHeader ?? 'managed-agents-2026-04-01';
  return async (request) => {
    const res = await fetch(`${options.baseUrl}${request.path}`, {
      method: request.method,
      headers: {
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': beta,
        'content-type': 'application/json',
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  };
}
