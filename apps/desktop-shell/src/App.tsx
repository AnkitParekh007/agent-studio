import { Button } from '@agent-studio/ui';
import { useEffect, useMemo, useState } from 'react';
import { desktopApi, type OrgRow, type PublicApp } from './lib/api';
import { loadSessionCookie } from './lib/session-store';

type ChatLine = { role: 'user' | 'assistant'; text: string };

export function App() {
  const [email, setEmail] = useState('owner@example.com');
  const [password, setPassword] = useState('Password123!');
  const [userName, setUserName] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgId, setOrgId] = useState('');
  const [orgSlug, setOrgSlug] = useState('acme');
  const [appSlug, setAppSlug] = useState('');
  const [app, setApp] = useState<PublicApp | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const cookie = await loadSessionCookie();
        if (!cookie) return;
        const me = await desktopApi.meOrgs();
        setUserName(me.user.name);
        setOrgs(me.organizations);
        const first = me.organizations[0];
        if (first) {
          setOrgId(first.organizationId);
          setOrgSlug(first.slug);
        }
      } catch {
        await desktopApi.signOut();
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const theme = useMemo(
    () => ({
      primary: app?.application.theme.primaryColor ?? '#0F766E',
      muted: app?.application.theme.mutedTextColor ?? '#5b6b66',
      font: app?.application.theme.fontFamily ?? 'Segoe UI, IBM Plex Sans, sans-serif',
    }),
    [app],
  );

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      await desktopApi.signIn(email, password);
      const me = await desktopApi.meOrgs();
      setUserName(me.user.name);
      setOrgs(me.organizations);
      const first = me.organizations[0];
      if (first) {
        setOrgId(first.organizationId);
        setOrgSlug(first.slug);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await desktopApi.signOut();
    setUserName(null);
    setOrgs([]);
    setOrgId('');
    setApp(null);
    setLines([]);
  }

  async function loadApp() {
    setError(null);
    setBusy(true);
    try {
      const publicApp = await desktopApi.getPublicApp(orgSlug, appSlug);
      setApp(publicApp);
      setOrgId(publicApp.organization.id);
      setLines([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setBusy(false);
    }
  }

  async function checkForUpdates() {
    setUpdateMessage(null);
    setError(null);
    try {
      // Dynamic import keeps Vite web preview working without the native plugin.
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        setUpdateMessage('You are on the latest version.');
        return;
      }
      setUpdateMessage(`Update ${update.version} available — downloading…`);
      await update.downloadAndInstall();
      setUpdateMessage('Update installed. Restart the app to finish.');
    } catch (err) {
      setUpdateMessage(
        err instanceof Error
          ? `Updater: ${err.message}`
          : 'Updater unavailable (configure pubkey + release CDN for production).',
      );
    }
  }

  async function send(text: string) {
    if (!app || !text.trim()) return;
    setBusy(true);
    setError(null);
    setLines((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    try {
      const session = await desktopApi.startSession(
        orgId || app.organization.id,
        app.publication.id,
        text,
      );
      await desktopApi.streamSession(orgId || app.organization.id, session.sessionId, (assistant) => {
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
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session failed');
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <div className="app">
        <div className="shell">
          <p className="muted">Starting desktop shell…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{ fontFamily: theme.font }}>
      <header className="topbar">
        <div className="brand">
          Agent Studio <span>Desktop</span>
        </div>
        {userName ? (
          <div className="row">
            <span className="muted">{userName}</span>
            <button className="secondary" onClick={() => void checkForUpdates()}>
              Check updates
            </button>
            <button className="secondary" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      <main className="shell">
        {error ? <p className="error">{error}</p> : null}
        {updateMessage ? <p className="muted">{updateMessage}</p> : null}

        {!userName ? (
          <section className="card">
            <h1>Sign in</h1>
            <p className="muted">
              Authenticate against the platform. Session tokens are stored in the OS keychain when
              running inside Tauri.
            </p>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <Button onClick={() => void signIn()} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </section>
        ) : (
          <>
            <section className="card">
              <h2>Open published application</h2>
              <p className="muted">
                Loads authorized public app config, then streams chat through the Agent Gateway. No
                provider secrets ever reach this shell.
              </p>
              <label>
                Organization
                <select
                  value={orgId}
                  onChange={(e) => {
                    const next = orgs.find((o) => o.organizationId === e.target.value);
                    setOrgId(e.target.value);
                    if (next) setOrgSlug(next.slug);
                  }}
                >
                  {orgs.map((org) => (
                    <option key={org.organizationId} value={org.organizationId}>
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Application slug
                <input
                  value={appSlug}
                  onChange={(e) => setAppSlug(e.target.value)}
                  placeholder="support-concierge"
                />
              </label>
              <Button onClick={() => void loadApp()} disabled={busy || !appSlug}>
                {busy ? 'Loading…' : 'Load application'}
              </Button>
            </section>

            {app ? (
              <section className="card">
                <h2 style={{ color: theme.primary }}>{app.application.name}</h2>
                <p className="muted" style={{ color: theme.muted }}>
                  {app.application.welcomeMessage}
                </p>
                {(app.application.studioConfig?.featureFlags?.showStarterPrompts ?? true) &&
                app.application.starterPrompts.length ? (
                  <div className="row">
                    {app.application.starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        className="chip"
                        disabled={busy}
                        onClick={() => void send(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="chat">
                  {lines.map((line, idx) => (
                    <div key={`${line.role}-${idx}`} className={`bubble ${line.role}`}>
                      {line.text}
                    </div>
                  ))}
                </div>

                <div className="row">
                  <input
                    style={{ flex: 1 }}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask something…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void send(input);
                    }}
                  />
                  <Button onClick={() => void send(input)} disabled={busy}>
                    {busy ? 'Running…' : 'Send'}
                  </Button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
