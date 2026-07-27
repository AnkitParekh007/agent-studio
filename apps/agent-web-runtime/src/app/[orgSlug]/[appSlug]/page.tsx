'use client';

import { Button } from '@agent-studio/ui';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type StudioConfig = {
  logoUrl?: string | null;
  welcomeMessage: string;
  starterPrompts: string[];
  chatLayout: 'centered' | 'full';
  navigationLabel: string;
  termsUrl?: string | null;
  privacyUrl?: string | null;
  supportContact?: string | null;
  theme: {
    primaryColor: string;
    backgroundColor: string;
    surfaceColor: string;
    textColor: string;
    mutedTextColor: string;
    fontFamily: string;
    borderRadius: string;
  };
  featureFlags: {
    fileUpload: boolean;
    artifactPreview: boolean;
    voiceControls: boolean;
    userFeedback: boolean;
    showStarterPrompts: boolean;
    showBrandingFooter: boolean;
  };
};

type PublicApp = {
  organization: { id: string; slug: string; name: string };
  application: {
    id: string;
    name: string;
    description?: string | null;
    logoUrl?: string | null;
    welcomeMessage: string;
    theme: StudioConfig['theme'];
    starterPrompts: string[];
    studioConfig: StudioConfig;
  };
  publication: { id: string; allowedOrigins?: string[] };
};

type ChatLine = { role: 'user' | 'assistant'; text: string };

const READY_MESSAGE = 'agent-studio:ready';
const TOKEN_MESSAGE = 'agent-studio:token';

function readPublicationToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('publicationToken');
}

export default function HostedAppPage() {
  const params = useParams<{ orgSlug: string; appSlug: string }>();
  const [app, setApp] = useState<PublicApp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [publicationToken, setPublicationToken] = useState<string | null>(null);

  useEffect(() => {
    setPublicationToken(readPublicationToken());
    void fetch(`${API_BASE}/api/public/apps/${params.orgSlug}/${params.appSlug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<PublicApp>;
      })
      .then(setApp)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load app'));
  }, [params.orgSlug, params.appSlug]);

  // When framed by an allowlisted host, accept a publication token over postMessage.
  // Otherwise the platform session cookie authenticates the caller.
  const allowedOrigins = useMemo(
    () => app?.publication.allowedOrigins ?? [],
    [app],
  );

  useEffect(() => {
    if (allowedOrigins.length === 0 || window.parent === window) return;

    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.includes(event.origin)) return;
      if (event.source !== window.parent) return;
      const data = event.data as { type?: unknown; token?: unknown } | null;
      if (!data || data.type !== TOKEN_MESSAGE) return;
      if (typeof data.token !== 'string' || !data.token.startsWith('pub_')) return;
      window.sessionStorage.setItem('publicationToken', data.token);
      setPublicationToken(data.token);
    };

    window.addEventListener('message', onMessage);
    for (const origin of allowedOrigins) {
      window.parent.postMessage({ type: READY_MESSAGE }, origin);
    }
    return () => window.removeEventListener('message', onMessage);
  }, [allowedOrigins]);

  const studio = app?.application.studioConfig;
  const theme = useMemo(
    () => ({
      background: studio?.theme.backgroundColor ?? '#F8FAFC',
      surface: studio?.theme.surfaceColor ?? '#FFFFFF',
      primary: studio?.theme.primaryColor ?? '#0F766E',
      text: studio?.theme.textColor ?? '#0F172A',
      muted: studio?.theme.mutedTextColor ?? '#475569',
      font: studio?.theme.fontFamily ?? 'IBM Plex Sans, sans-serif',
      radius: studio?.theme.borderRadius ?? '12px',
    }),
    [studio],
  );

  async function send(text: string) {
    if (!app || !text.trim()) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    setLines((prev) => [...prev, { role: 'user', text }]);
    setInput('');

    try {
      const orgId = app.organization.id;
      const token = publicationToken ?? readPublicationToken();
      const authHeaders: Record<string, string> = {
        'x-organization-id': orgId,
      };
      if (token) authHeaders['x-publication-token'] = token;

      const startRes = await fetch(`${API_BASE}/api/gateway/sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ publicationId: app.publication.id, message: text }),
      });
      if (!startRes.ok) throw new Error(await startRes.text());
      const session = (await startRes.json()) as { sessionId: string };

      const streamRes = await fetch(`${API_BASE}/api/gateway/sessions/${session.sessionId}/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders,
      });
      if (!streamRes.ok || !streamRes.body) throw new Error(await streamRes.text());

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let assistant = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const linesRaw = part.split('\n');
          const eventLine = linesRaw.find((l) => l.startsWith('event:'));
          const dataLine = linesRaw.find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const eventType = eventLine?.slice(6).trim();
          const payload = JSON.parse(dataLine.slice(5)) as {
            payload?: { text?: string };
            type?: string;
          };
          if (eventType === 'message.delta' && payload.payload?.text) {
            assistant += payload.payload.text;
            setLines((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = { role: 'assistant', text: assistant };
              } else {
                copy.push({ role: 'assistant', text: assistant });
              }
              return copy;
            });
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !app) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'IBM Plex Sans, sans-serif' }}>
        <p style={{ color: '#b91c1c' }}>{error}</p>
      </main>
    );
  }

  if (!app || !studio) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'IBM Plex Sans, sans-serif' }}>Loading…</main>
    );
  }

  const maxWidth = studio.chatLayout === 'full' ? 1100 : 820;
  const logo = studio.logoUrl || app.application.logoUrl;
  const starters = studio.featureFlags.showStarterPrompts ? studio.starterPrompts : [];

  return (
    <main
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${theme.background}, ${theme.surface})`,
        fontFamily: theme.font,
        color: theme.text,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          borderBottom: `1px solid color-mix(in srgb, ${theme.muted} 25%, transparent)`,
          background: `color-mix(in srgb, ${theme.surface} 88%, transparent)`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            maxWidth,
            margin: '0 auto',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {logo ? <img src={logo} alt="" style={{ height: 32, width: 'auto' }} /> : null}
          <div>
            <div style={{ fontSize: 13, color: theme.muted }}>{studio.navigationLabel}</div>
            <strong style={{ color: theme.primary }}>{app.application.name}</strong>
          </div>
        </div>
      </header>

      <div style={{ maxWidth, margin: '0 auto', padding: '1.5rem 1rem 2rem', width: '100%', flex: 1 }}>
        {lines.length === 0 ? (
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ marginBottom: 8, color: theme.primary, fontSize: '1.75rem' }}>
              {app.application.name}
            </h1>
            <p style={{ color: theme.muted, marginTop: 0 }}>{studio.welcomeMessage}</p>
            {starters.length ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {starters.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void send(prompt)}
                    disabled={busy}
                    style={{
                      border: `1px solid ${theme.primary}`,
                      background: theme.surface,
                      color: theme.primary,
                      borderRadius: 999,
                      padding: '0.35rem 0.8rem',
                      cursor: 'pointer',
                      font: 'inherit',
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            border: `1px solid color-mix(in srgb, ${theme.muted} 30%, transparent)`,
            borderRadius: theme.radius,
            background: `color-mix(in srgb, ${theme.surface} 92%, transparent)`,
            padding: '1rem',
            minHeight: 280,
            display: 'grid',
            gap: 10,
          }}
        >
          {lines.map((line, idx) => (
            <div
              key={`${line.role}-${idx}`}
              style={{
                justifySelf: line.role === 'user' ? 'end' : 'start',
                maxWidth: '80%',
                background: line.role === 'user' ? theme.primary : theme.background,
                color: line.role === 'user' ? '#fff' : theme.text,
                padding: '0.65rem 0.8rem',
                borderRadius: theme.radius,
              }}
            >
              {line.text}
            </div>
          ))}
          {studio.featureFlags.artifactPreview && lines.some((l) => l.role === 'assistant') ? (
            <div style={{ color: theme.muted, fontSize: 13 }}>
              Artifact preview enabled for this application.
            </div>
          ) : null}
        </div>

        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

        {!publicationToken ? (
          <p style={{ color: theme.muted, fontSize: 13, marginTop: 8 }}>
            End-user chat needs a platform session, or a publication token delivered by an
            allowlisted host page over <code>postMessage</code>. Tokens are never accepted from the
            URL.
          </p>
        ) : null}

        {studio.featureFlags.userFeedback && lines.some((l) => l.role === 'assistant') ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <span style={{ color: theme.muted, fontSize: 13 }}>Was this helpful?</span>
            <button
              type="button"
              onClick={() => setFeedback('up')}
              style={{
                border: `1px solid ${theme.primary}`,
                background: feedback === 'up' ? theme.primary : theme.surface,
                color: feedback === 'up' ? '#fff' : theme.primary,
                borderRadius: 8,
                padding: '0.2rem 0.55rem',
                cursor: 'pointer',
              }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setFeedback('down')}
              style={{
                border: `1px solid ${theme.muted}`,
                background: feedback === 'down' ? theme.muted : theme.surface,
                color: feedback === 'down' ? '#fff' : theme.muted,
                borderRadius: 8,
                padding: '0.2rem 0.55rem',
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          {studio.featureFlags.fileUpload ? (
            <label
              style={{
                border: `1px dashed ${theme.muted}`,
                borderRadius: 8,
                padding: '0.55rem 0.7rem',
                color: theme.muted,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Attach
              <input type="file" style={{ display: 'none' }} disabled />
            </label>
          ) : null}
          {studio.featureFlags.voiceControls ? (
            <button
              type="button"
              disabled
              title="Voice controls reserved for a later release"
              style={{
                border: `1px solid ${theme.muted}`,
                background: theme.surface,
                color: theme.muted,
                borderRadius: 8,
                padding: '0.55rem 0.7rem',
                cursor: 'not-allowed',
                font: 'inherit',
              }}
            >
              Voice
            </button>
          ) : null}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something…"
            style={{
              flex: 1,
              borderRadius: 8,
              border: `1px solid color-mix(in srgb, ${theme.muted} 35%, transparent)`,
              padding: '0.7rem 0.8rem',
              font: 'inherit',
              background: theme.surface,
              color: theme.text,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send(input);
            }}
          />
          <Button onClick={() => void send(input)} disabled={busy}>
            {busy ? 'Running…' : 'Send'}
          </Button>
        </div>
      </div>

      {studio.featureFlags.showBrandingFooter ? (
        <footer
          style={{
            borderTop: `1px solid color-mix(in srgb, ${theme.muted} 25%, transparent)`,
            padding: '0.9rem 1rem',
            color: theme.muted,
            fontSize: 13,
          }}
        >
          <div
            style={{
              maxWidth,
              margin: '0 auto',
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <span>
              {app.organization.name} · {studio.navigationLabel}
            </span>
            {studio.termsUrl ? (
              <a href={studio.termsUrl} style={{ color: theme.primary }}>
                Terms
              </a>
            ) : null}
            {studio.privacyUrl ? (
              <a href={studio.privacyUrl} style={{ color: theme.primary }}>
                Privacy
              </a>
            ) : null}
            {studio.supportContact ? <span>Support: {studio.supportContact}</span> : null}
          </div>
        </footer>
      ) : null}
    </main>
  );
}
