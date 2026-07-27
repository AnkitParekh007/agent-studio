'use client';

import { Button, Panel, StatusBadge } from '@agent-studio/ui';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { client } from '@/lib/api';

function orgId() {
  return localStorage.getItem('as_org_id') ?? '';
}

type StudioConfig = {
  welcomeMessage: string;
  starterPrompts: string[];
  logoUrl?: string | null;
  termsUrl?: string | null;
  privacyUrl?: string | null;
  supportContact?: string | null;
  chatLayout: 'centered' | 'full';
  navigationLabel: string;
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

export default function ApplicationDetailPage() {
  const params = useParams<{ applicationId: string }>();
  const applicationId = params.applicationId;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [hostedPath, setHostedPath] = useState<string | null>(null);
  const [channels, setChannels] = useState<Record<string, { publicationId?: string; url?: string | null; path?: string | null; allowedOrigins?: string[] } | null>>({});
  const [embedOriginsText, setEmbedOriginsText] = useState('');
  const [mintedToken, setMintedToken] = useState<string | null>(null);
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [starterText, setStarterText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const app = await client.getApplication(orgId(), applicationId);
    setName(String(app.name ?? ''));
    setDescription(String(app.description ?? ''));
    setStatus(String(app.status ?? 'draft'));
    setHostedPath((app.hostedPath as string | null) ?? null);
    const nextChannels = (app.channels as typeof channels) ?? {};
    setChannels(nextChannels);
    setEmbedOriginsText((nextChannels.embed?.allowedOrigins ?? []).join('\n'));
    const studio = app.studioConfig as StudioConfig;
    setConfig(studio);
    setStarterText((studio.starterPrompts ?? []).join('\n'));
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, [applicationId]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const starterPrompts = starterText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await client.updateApplication(orgId(), applicationId, {
        name,
        description,
        studioConfig: {
          ...config,
          starterPrompts,
        },
      });
      setMessage('Saved');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function parsedEmbedOrigins() {
    return embedOriginsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function publish(channel: 'hosted_web' | 'embed' | 'api' | 'desktop') {
    setError(null);
    setMintedToken(null);
    try {
      const published = await client.publishApplication(
        orgId(),
        applicationId,
        channel,
        channel === 'embed' ? parsedEmbedOrigins() : [],
      );
      setMessage(`Published on ${channel}`);
      setHostedPath((published.hostedPath as string | null) ?? null);
      const nextChannels = (published.channels as typeof channels) ?? {};
      setChannels(nextChannels);
      setEmbedOriginsText((nextChannels.embed?.allowedOrigins ?? []).join('\n'));
      setStatus(String(published.status ?? 'published'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    }
  }

  async function saveEmbedOrigins() {
    setError(null);
    const pubId = channels.embed?.publicationId;
    if (!pubId) {
      setError('Publish the embed channel first');
      return;
    }
    try {
      await client.setPublicationAllowedOrigins(orgId(), pubId, parsedEmbedOrigins());
      setMessage('Embed allowed origins updated');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function mintToken(channel: 'hosted_web' | 'embed' | 'api' | 'desktop') {
    setError(null);
    const pubId = channels[channel]?.publicationId;
    if (!pubId) {
      setError(`Publish ${channel} first`);
      return;
    }
    try {
      const token = await client.createPublicationToken(orgId(), pubId, {
        name: `${channel}-default`,
        expiresInDays: 30,
      });
      setMintedToken(token.token);
      setMessage(`Minted ${channel} publication token (shown once)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token mint failed');
    }
  }

  if (!config) {
    return <p className="muted">Loading application…</p>;
  }

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>{name || 'Application'}</h1>
        <StatusBadge status={status} />
      </div>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <Panel title="Basics">
        <div className="stack">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Navigation label
            <input
              value={config.navigationLabel}
              onChange={(e) => setConfig({ ...config, navigationLabel: e.target.value })}
            />
          </label>
          <label>
            Welcome message
            <textarea
              value={config.welcomeMessage}
              onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
            />
          </label>
          <label>
            Starter prompts (one per line)
            <textarea value={starterText} onChange={(e) => setStarterText(e.target.value)} rows={4} />
          </label>
        </div>
      </Panel>

      <Panel title="Branding">
        <div className="stack">
          <label>
            Logo URL
            <input
              value={config.logoUrl ?? ''}
              onChange={(e) => setConfig({ ...config, logoUrl: e.target.value || null })}
            />
          </label>
          <div className="row">
            <label style={{ flex: 1 }}>
              Primary color
              <input
                value={config.theme.primaryColor}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    theme: { ...config.theme, primaryColor: e.target.value },
                  })
                }
              />
            </label>
            <label style={{ flex: 1 }}>
              Background
              <input
                value={config.theme.backgroundColor}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    theme: { ...config.theme, backgroundColor: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <label>
            Typography
            <input
              value={config.theme.fontFamily}
              onChange={(e) =>
                setConfig({
                  ...config,
                  theme: { ...config.theme, fontFamily: e.target.value },
                })
              }
            />
          </label>
          <label>
            Chat layout
            <select
              value={config.chatLayout}
              onChange={(e) =>
                setConfig({
                  ...config,
                  chatLayout: e.target.value as 'centered' | 'full',
                })
              }
            >
              <option value="centered">Centered</option>
              <option value="full">Full width</option>
            </select>
          </label>
        </div>
      </Panel>

      <Panel title="Features & links">
        <div className="stack">
          {(
            [
              ['fileUpload', 'File upload'],
              ['artifactPreview', 'Artifact preview'],
              ['voiceControls', 'Voice controls'],
              ['userFeedback', 'User feedback'],
              ['showStarterPrompts', 'Show starter prompts'],
              ['showBrandingFooter', 'Show branding footer'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={config.featureFlags[key]}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    featureFlags: {
                      ...config.featureFlags,
                      [key]: e.target.checked,
                    },
                  })
                }
              />
            </label>
          ))}
          <label>
            Terms URL
            <input
              value={config.termsUrl ?? ''}
              onChange={(e) => setConfig({ ...config, termsUrl: e.target.value || null })}
            />
          </label>
          <label>
            Privacy URL
            <input
              value={config.privacyUrl ?? ''}
              onChange={(e) => setConfig({ ...config, privacyUrl: e.target.value || null })}
            />
          </label>
          <label>
            Support contact
            <input
              value={config.supportContact ?? ''}
              onChange={(e) => setConfig({ ...config, supportContact: e.target.value || null })}
            />
          </label>
        </div>
      </Panel>

      <div className="row">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save draft'}
        </Button>
      </div>

      <Panel title="Publish anywhere">
        <div className="stack">
          <p className="muted" style={{ marginTop: 0 }}>
            Each channel gets its own active publication. Mint a <code>pub_</code> token for embed/API
            end users.
          </p>
          {(
            [
              ['hosted_web', 'Hosted web', channels.hosted_web?.url ?? (hostedPath ? `http://localhost:3001${hostedPath}` : null)],
              ['embed', 'Embed iframe', channels.embed?.url ?? null],
              ['api', 'Public API', channels.api ? 'http://localhost:4000/api/v1' : null],
              ['desktop', 'Desktop shell', channels.desktop ? 'Open desktop app with org/app slug' : null],
            ] as const
          ).map(([channel, label, link]) => (
            <div key={channel} className="row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ minWidth: 110 }}>{label}</strong>
              <Button variant="secondary" onClick={() => void publish(channel)}>
                Publish
              </Button>
              <Button variant="secondary" onClick={() => void mintToken(channel)}>
                Mint token
              </Button>
              {link ? (
                typeof link === 'string' && link.startsWith('http') ? (
                  <a href={link} target="_blank" rel="noreferrer">
                    Open
                  </a>
                ) : (
                  <span className="muted">{link}</span>
                )
              ) : (
                <span className="muted">Not published</span>
              )}
            </div>
          ))}
          <label>
            Embed allowed origins (one per line, e.g. <code>https://intranet.example.com</code>)
            <textarea
              value={embedOriginsText}
              onChange={(e) => setEmbedOriginsText(e.target.value)}
              rows={3}
              placeholder="https://intranet.example.com"
            />
          </label>
          <p className="muted" style={{ marginTop: 0 }}>
            Empty means default deny: no site may frame the embed or receive a publication token.
          </p>
          <div className="row">
            <Button variant="secondary" onClick={() => void saveEmbedOrigins()}>
              Save embed origins
            </Button>
          </div>
          {mintedToken ? (
            <p className="success">
              Token (copy now): <code>{mintedToken}</code>
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel title="Preview">
        <div
          style={{
            borderRadius: config.theme.borderRadius,
            background: `linear-gradient(180deg, ${config.theme.backgroundColor}, ${config.theme.surfaceColor})`,
            color: config.theme.textColor,
            fontFamily: config.theme.fontFamily,
            padding: '1.25rem',
            border: '1px solid var(--as-border)',
          }}
        >
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" style={{ height: 36, marginBottom: 12 }} />
          ) : null}
          <h2 style={{ margin: 0, color: config.theme.primaryColor }}>{name}</h2>
          <p style={{ color: config.theme.mutedTextColor }}>{config.welcomeMessage}</p>
          <div className="row">
            {starterText
              .split('\n')
              .filter(Boolean)
              .slice(0, 3)
              .map((prompt) => (
                <span
                  key={prompt}
                  style={{
                    border: `1px solid ${config.theme.primaryColor}`,
                    color: config.theme.primaryColor,
                    borderRadius: 999,
                    padding: '0.25rem 0.7rem',
                    fontSize: 13,
                  }}
                >
                  {prompt}
                </span>
              ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
