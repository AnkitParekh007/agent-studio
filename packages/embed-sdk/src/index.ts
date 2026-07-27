export type EmbedPublicApp = {
  organization: { id: string; slug: string; name: string };
  application: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    welcomeMessage: string;
    theme: Record<string, string>;
    starterPrompts: string[];
  };
  publication: { id: string; channel: string; allowedOrigins: string[] };
};

export type EmbedClientOptions = {
  apiBaseUrl: string;
  organizationId: string;
  publicationToken?: string;
};

export type StreamHandlers = {
  onEvent?: (eventType: string, payload: unknown) => void;
  onDelta?: (text: string) => void;
  onError?: (message: string) => void;
};

export class AgentStudioEmbedClient {
  constructor(private readonly options: EmbedClientOptions) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'x-organization-id': this.options.organizationId,
      ...extra,
    };
    if (this.options.publicationToken) {
      headers['x-publication-token'] = this.options.publicationToken;
    }
    return headers;
  }

  async fetchPublicApp(
    orgSlug: string,
    appSlug: string,
    channel: 'embed' | 'hosted_web' | 'api' | 'desktop' = 'embed',
  ): Promise<EmbedPublicApp> {
    const res = await fetch(
      `${this.options.apiBaseUrl}/api/public/apps/${orgSlug}/${appSlug}?channel=${channel}`,
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<EmbedPublicApp>;
  }

  async startSession(publicationId: string, message?: string) {
    const res = await fetch(`${this.options.apiBaseUrl}/api/v1/sessions`, {
      method: 'POST',
      credentials: 'include',
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ publicationId, message }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ sessionId: string; correlationId: string }>;
  }

  async streamSession(sessionId: string, handlers: StreamHandlers = {}) {
    const res = await fetch(`${this.options.apiBaseUrl}/api/v1/sessions/${sessionId}/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: this.headers(),
    });
    if (!res.ok || !res.body) throw new Error(await res.text());

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistant = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const lines = part.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event:'));
        const dataLine = lines.find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const eventType = eventLine?.slice(6).trim() ?? 'message';
        const payload = JSON.parse(dataLine.slice(5)) as {
          payload?: { text?: string; message?: string };
        };
        handlers.onEvent?.(eventType, payload);
        if (eventType === 'message.delta' && payload.payload?.text) {
          assistant += payload.payload.text;
          handlers.onDelta?.(assistant);
        }
        if (eventType === 'error') {
          handlers.onError?.(payload.payload?.message ?? 'stream error');
        }
      }
    }
    return { assistantText: assistant };
  }

  async chat(publicationId: string, message: string, handlers: StreamHandlers = {}) {
    const session = await this.startSession(publicationId, message);
    const result = await this.streamSession(session.sessionId, handlers);
    return { ...session, ...result };
  }
}

export const EMBED_READY_MESSAGE = 'agent-studio:ready';
export const EMBED_TOKEN_MESSAGE = 'agent-studio:token';

/**
 * Browser helper: mount a minimal iframe pointing at the embed runtime.
 * Publication tokens are never placed in the URL; use `attachPublicationToken`.
 */
export function createEmbedIframe(input: {
  embedRuntimeOrigin: string;
  orgSlug: string;
  appSlug: string;
  title?: string;
}): HTMLIFrameElement {
  const url = new URL(
    `/embed/${input.orgSlug}/${input.appSlug}`,
    input.embedRuntimeOrigin,
  );
  const iframe = document.createElement('iframe');
  iframe.src = url.toString();
  iframe.title = input.title ?? 'Agent Studio';
  iframe.style.border = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.setAttribute('allow', 'clipboard-write');
  return iframe;
}

/**
 * Deliver a publication token to an embed iframe over postMessage once it reports ready.
 * Keeps the token out of URLs, referrers, and server logs. Returns a detach function.
 */
export function attachPublicationToken(
  iframe: HTMLIFrameElement,
  token: string,
  embedOrigin: string,
): () => void {
  const targetOrigin = new URL(embedOrigin).origin;

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== targetOrigin) return;
    if (event.source !== iframe.contentWindow) return;
    const data = event.data as { type?: unknown } | null;
    if (!data || data.type !== EMBED_READY_MESSAGE) return;
    iframe.contentWindow?.postMessage({ type: EMBED_TOKEN_MESSAGE, token }, targetOrigin);
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
