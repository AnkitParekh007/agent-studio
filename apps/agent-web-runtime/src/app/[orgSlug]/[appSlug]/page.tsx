'use client';

import { Button } from '@agent-studio/ui';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type PublicApp = {
  organization: { id: string; slug: string; name: string };
  application: {
    id: string;
    name: string;
    welcomeMessage: string;
    theme: { primaryColor?: string; backgroundColor?: string; fontFamily?: string };
    starterPrompts: string[];
  };
  publication: { id: string };
};

type ChatLine = { role: 'user' | 'assistant'; text: string };

export default function HostedAppPage() {
  const params = useParams<{ orgSlug: string; appSlug: string }>();
  const [app, setApp] = useState<PublicApp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`${API_BASE}/api/public/apps/${params.orgSlug}/${params.appSlug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<PublicApp>;
      })
      .then(setApp)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load app'));
  }, [params.orgSlug, params.appSlug]);

  const theme = useMemo(
    () => ({
      background: app?.application.theme.backgroundColor ?? '#F8FAFC',
      primary: app?.application.theme.primaryColor ?? '#0F766E',
      font: app?.application.theme.fontFamily ?? 'IBM Plex Sans, sans-serif',
    }),
    [app],
  );

  async function send(text: string) {
    if (!app || !text.trim()) return;
    setBusy(true);
    setError(null);
    setLines((prev) => [...prev, { role: 'user', text }]);
    setInput('');

    try {
      const orgId = app.organization.id;
      const startRes = await fetch(`${API_BASE}/api/gateway/sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-organization-id': orgId,
        },
        body: JSON.stringify({ publicationId: app.publication.id, message: text }),
      });
      if (!startRes.ok) throw new Error(await startRes.text());
      const session = (await startRes.json()) as { sessionId: string };

      const streamRes = await fetch(`${API_BASE}/api/gateway/sessions/${session.sessionId}/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-organization-id': orgId },
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

  if (!app) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'IBM Plex Sans, sans-serif' }}>Loading…</main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${theme.background}, #ffffff)`,
        fontFamily: theme.font,
        color: '#0f172a',
      }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem 4rem' }}>
        <h1 style={{ marginBottom: 0, color: theme.primary }}>{app.application.name}</h1>
        <p style={{ color: '#475569' }}>{app.application.welcomeMessage}</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {app.application.starterPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => void send(prompt)}
              style={{
                border: `1px solid ${theme.primary}`,
                background: 'white',
                color: theme.primary,
                borderRadius: 999,
                padding: '0.35rem 0.8rem',
                cursor: 'pointer',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.9)',
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
                background: line.role === 'user' ? theme.primary : '#e2e8f0',
                color: line.role === 'user' ? 'white' : '#0f172a',
                padding: '0.65rem 0.8rem',
                borderRadius: 12,
              }}
            >
              {line.text}
            </div>
          ))}
        </div>

        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something…"
            style={{
              flex: 1,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              padding: '0.7rem 0.8rem',
              font: 'inherit',
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
    </main>
  );
}
