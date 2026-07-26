import { clearSessionCookie, extractSessionCookie, loadSessionCookie, saveSessionCookie } from './session-store';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export type OrgRow = {
  organizationId: string;
  name: string;
  slug: string;
  roleKey: string;
};

export type PublicApp = {
  organization: { id: string; slug: string; name: string };
  application: {
    id: string;
    name: string;
    welcomeMessage: string;
    theme: {
      primaryColor?: string;
      backgroundColor?: string;
      surfaceColor?: string;
      textColor?: string;
      mutedTextColor?: string;
      fontFamily?: string;
      borderRadius?: string;
    };
    starterPrompts: string[];
    studioConfig?: {
      featureFlags?: {
        showStarterPrompts?: boolean;
        showBrandingFooter?: boolean;
      };
      supportContact?: string | null;
      navigationLabel?: string;
    };
  };
  publication: { id: string };
};

async function isTauri(): Promise<boolean> {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function getSetCookies(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function applySseBuffer(
  buffer: string,
  onDelta: (text: string) => void,
  assistant: { value: string },
): string {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    const lines = part.split('\n');
    const eventLine = lines.find((l) => l.startsWith('event:'));
    const dataLine = lines.find((l) => l.startsWith('data:'));
    if (!dataLine) continue;
    const eventType = eventLine?.slice(6).trim();
    const payload = JSON.parse(dataLine.slice(5)) as { payload?: { text?: string } };
    if (eventType === 'message.delta' && payload.payload?.text) {
      assistant.value += payload.payload.text;
      onDelta(assistant.value);
    }
  }
  return rest;
}

async function tauriApiRequest<T>(input: {
  method: string;
  path: string;
  organizationId?: string;
  body?: string;
  skipAuth?: boolean;
}): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  const res = await invoke<{ status: number; body: string }>('api_request', {
    method: input.method,
    path: input.path,
    organizationId: input.organizationId ?? null,
    body: input.body ?? null,
    skipAuth: input.skipAuth ?? false,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(res.body || `HTTP ${res.status}`);
  }
  return JSON.parse(res.body) as T;
}

async function browserApi<T>(
  path: string,
  options: RequestInit & { organizationId?: string; skipAuth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('content-type') && options.body) {
    headers.set('content-type', 'application/json');
  }
  if (options.organizationId) {
    headers.set('x-organization-id', options.organizationId);
  }
  if (!options.skipAuth) {
    const cookie = await loadSessionCookie();
    if (cookie) headers.set('cookie', cookie);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json() as Promise<T>;
}

export const desktopApi = {
  async signIn(email: string, password: string) {
    if (await isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<{ user: { id: string; email: string; name: string } }>('auth_sign_in', {
        email,
        password,
      });
    }

    const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:1420',
      },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    const cookie = extractSessionCookie(getSetCookies(res));
    if (!cookie) throw new Error('Sign-in succeeded but no session cookie was returned');
    await saveSessionCookie(cookie);
    return res.json() as Promise<{ user: { id: string; email: string; name: string } }>;
  },

  async meOrgs() {
    if (await isTauri()) {
      return tauriApiRequest<{
        user: { id: string; email: string; name: string };
        organizations: OrgRow[];
      }>({
        method: 'GET',
        path: '/api/orgs/for-me',
      });
    }
    return browserApi<{
      user: { id: string; email: string; name: string };
      organizations: OrgRow[];
    }>('/api/orgs/for-me');
  },

  async signOut() {
    await clearSessionCookie();
  },

  async getPublicApp(orgSlug: string, appSlug: string) {
    const path = `/api/public/apps/${orgSlug}/${appSlug}`;
    if (await isTauri()) {
      return tauriApiRequest<PublicApp>({ method: 'GET', path, skipAuth: true });
    }
    return browserApi<PublicApp>(path, { skipAuth: true });
  },

  async startSession(organizationId: string, publicationId: string, message: string) {
    const body = JSON.stringify({ publicationId, message });
    if (await isTauri()) {
      return tauriApiRequest<{ sessionId: string }>({
        method: 'POST',
        path: '/api/gateway/sessions',
        organizationId,
        body,
      });
    }
    return browserApi<{ sessionId: string }>('/api/gateway/sessions', {
      method: 'POST',
      organizationId,
      body,
    });
  },

  async streamSession(
    organizationId: string,
    sessionId: string,
    onDelta: (text: string) => void,
  ) {
    if (await isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');
      const assistant = { value: '' };
      let buffer = '';

      const unlistenChunk = await listen<string>('gateway-stream-chunk', (event) => {
        buffer = applySseBuffer(buffer + event.payload, onDelta, assistant);
      });

      try {
        await invoke('gateway_stream', { sessionId, organizationId });
      } finally {
        unlistenChunk();
      }
      return;
    }

    const cookie = await loadSessionCookie();
    const res = await fetch(`${API_BASE}/api/gateway/sessions/${sessionId}/stream`, {
      method: 'POST',
      headers: {
        ...(cookie ? { cookie } : {}),
        'x-organization-id': organizationId,
      },
    });
    if (!res.ok || !res.body) throw new Error(await res.text());

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const assistant = { value: '' };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = applySseBuffer(buffer + decoder.decode(value, { stream: true }), onDelta, assistant);
    }
  },
};
