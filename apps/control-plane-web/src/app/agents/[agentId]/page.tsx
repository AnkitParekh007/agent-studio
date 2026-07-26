'use client';

import { Button, Panel, StatusBadge } from '@agent-studio/ui';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { client } from '@/lib/api';

function orgId() {
  return localStorage.getItem('as_org_id') ?? '';
}

export default function AgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const [agent, setAgent] = useState<Record<string, unknown> | null>(null);
  const [purpose, setPurpose] = useState('Help users resolve product questions.');
  const [raw, setRaw] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-5');
  const [provider, setProvider] = useState<'local' | 'claude'>('local');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishSlug, setPublishSlug] = useState('support-app');
  const [publishedPath, setPublishedPath] = useState<string | null>(null);

  async function load() {
    const agents = await client.listAgents(orgId());
    const found = agents.find((a) => a.id === agentId) as Record<string, unknown> | undefined;
    setAgent(found ?? null);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, [agentId]);

  async function saveDraft() {
    try {
      await client.updateDraft(orgId(), agentId, {
        config: {
          model,
          runtimeProvider: provider,
          rawInstructions: raw,
          instructions: { purpose },
          starterPrompts: ['What can you help me with?'],
        },
      });
      setMessage('Draft saved');
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function submit() {
    try {
      await client.submit(orgId(), agentId);
      setMessage('Submitted for approval');
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    }
  }

  async function publish() {
    try {
      const result = await client.publish(orgId(), {
        agentId,
        name: String(agent?.name ?? 'Published App'),
        slug: publishSlug,
      });
      setPublishedPath(result.path);
      setMessage('Published hosted application');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    }
  }

  if (!agent) {
    return <p className="muted">Loading agent…</p>;
  }

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>{String(agent.name)}</h1>
        <StatusBadge status={String(agent.lifecycleStatus)} />
      </div>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <Panel title="Instructions">
        <div className="stack">
          <label>
            Purpose
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} />
          </label>
          <label>
            Advanced raw instructions (optional)
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={5} />
          </label>
          <label>
            Model
            <input value={model} onChange={(e) => setModel(e.target.value)} />
          </label>
          <label>
            Runtime provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'local' | 'claude')}
            >
              <option value="local">local (development only)</option>
              <option value="claude">claude (Managed Agents)</option>
            </select>
          </label>
          <div className="row">
            <Button onClick={saveDraft}>Save draft</Button>
            <Button variant="secondary" onClick={submit}>
              Submit for approval
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Publish hosted app">
        <div className="stack">
          <p className="muted">
            Requires an approved version and a ready deployment from the provision worker.
          </p>
          <label>
            Application slug
            <input value={publishSlug} onChange={(e) => setPublishSlug(e.target.value)} />
          </label>
          <Button onClick={publish}>Publish</Button>
          {publishedPath ? (
            <p>
              Open{' '}
              <a href={`http://localhost:3001${publishedPath}`} target="_blank" rel="noreferrer">
                {publishedPath}
              </a>
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
