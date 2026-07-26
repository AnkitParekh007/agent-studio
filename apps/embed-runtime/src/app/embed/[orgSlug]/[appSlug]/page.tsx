'use client';

import { AgentStudioEmbedClient } from '@agent-studio/embed-sdk';
import { Button } from '@agent-studio/ui';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type ChatLine = { role: 'user' | 'assistant'; text: string };

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromQuery = new URLSearchParams(window.location.search).get('token');
  if (fromQuery?.startsWith('pub_')) {
    window.sessionStorage.setItem('publicationToken', fromQuery);
    return fromQuery;
  }
  return window.sessionStorage.getItem('publicationToken');
}

export default function EmbedAppPage() {
  const params = useParams<{ orgSlug: string; appSlug: string }>();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [publicationId, setPublicationId] = useState<string | null>(null);
  const [title, setTitle] = useState('Agent');
  const [welcome, setWelcome] = useState('');
  const [primary, setPrimary] = useState('#0F766E');
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const publicationToken = readToken();
    setToken(publicationToken);
    const bootstrap = new AgentStudioEmbedClient({
      apiBaseUrl: API_BASE,
      organizationId: 'pending',
      publicationToken: publicationToken ?? undefined,
    });
    void bootstrap
      .fetchPublicApp(params.orgSlug, params.appSlug, 'embed')
      .then((app) => {
        setOrgId(app.organization.id);
        setPublicationId(app.publication.id);
        setTitle(app.application.name);
        setWelcome(app.application.welcomeMessage);
        setPrimary(app.application.theme.primaryColor ?? '#0F766E');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load embed app'));
  }, [params.orgSlug, params.appSlug]);

  const client = useMemo(() => {
    if (!orgId) return null;
    return new AgentStudioEmbedClient({
      apiBaseUrl: API_BASE,
      organizationId: orgId,
      publicationToken: token ?? undefined,
    });
  }, [orgId, token]);

  async function send(text: string) {
    if (!client || !publicationId || !text.trim()) return;
    setBusy(true);
    setError(null);
    setLines((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    try {
      await client.chat(publicationId, text, {
        onDelta: (assistant) => {
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
        },
        onError: (message) => setError(message),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        fontFamily: 'IBM Plex Sans, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      <header
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #e2e8f0',
          background: '#fff',
        }}
      >
        <strong style={{ color: primary }}>{title}</strong>
        <span style={{ marginLeft: 8, color: '#64748b', fontSize: 13 }}>Embedded</span>
      </header>
      <div style={{ flex: 1, padding: '1rem', display: 'grid', gap: 10 }}>
        {lines.length === 0 ? <p style={{ color: '#64748b', margin: 0 }}>{welcome}</p> : null}
        {lines.map((line, idx) => (
          <div
            key={`${line.role}-${idx}`}
            style={{
              justifySelf: line.role === 'user' ? 'end' : 'start',
              maxWidth: '85%',
              background: line.role === 'user' ? primary : '#fff',
              color: line.role === 'user' ? '#fff' : '#0f172a',
              padding: '0.6rem 0.75rem',
              borderRadius: 10,
              border: line.role === 'assistant' ? '1px solid #e2e8f0' : undefined,
            }}
          >
            {line.text}
          </div>
        ))}
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {!token ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>
            Pass <code>?token=pub_…</code> for end-user access without a platform login.
          </p>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask…"
          style={{
            flex: 1,
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            padding: '0.65rem 0.75rem',
            font: 'inherit',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send(input);
          }}
        />
        <Button onClick={() => void send(input)} disabled={busy || !client}>
          {busy ? '…' : 'Send'}
        </Button>
      </div>
    </main>
  );
}
