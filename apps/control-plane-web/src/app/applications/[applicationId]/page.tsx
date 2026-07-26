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

  async function publish() {
    setError(null);
    try {
      const published = await client.publishApplication(orgId(), applicationId);
      setMessage('Published hosted application');
      setHostedPath((published.hostedPath as string | null) ?? null);
      setStatus(String(published.status ?? 'published'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
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
        <Button variant="secondary" onClick={publish}>
          Publish hosted app
        </Button>
        {hostedPath ? (
          <a href={`http://localhost:3001${hostedPath}`} target="_blank" rel="noreferrer">
            Open {hostedPath}
          </a>
        ) : null}
      </div>

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
