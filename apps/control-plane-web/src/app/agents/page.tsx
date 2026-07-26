'use client';

import { Button, Panel, StatusBadge } from '@agent-studio/ui';
import { useEffect, useState } from 'react';
import { client } from '@/lib/api';

type Agent = {
  id: string;
  name: string;
  slug: string;
  lifecycleStatus: string;
  description: string;
};

function orgId() {
  return localStorage.getItem('as_org_id') ?? '';
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('Support Copilot');
  const [slug, setSlug] = useState('support-copilot');
  const [description, setDescription] = useState('Helps resolve customer questions.');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await client.listAgents(orgId());
      setAgents(rows as Agent[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    try {
      await client.createAgent(orgId(), { name, slug, description });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  return (
    <div className="stack">
      <h1>Agents</h1>
      {error ? <p className="error">{error}</p> : null}
      <Panel title="Create agent">
        <div className="stack">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Slug
            <input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <Button onClick={create}>Create draft</Button>
        </div>
      </Panel>
      <Panel title="Your agents">
        <ul className="list">
          {agents.map((agent) => (
            <li key={agent.id}>
              <a className="card-link" href={`/agents/${agent.id}`}>
                <div className="row">
                  <strong>{agent.name}</strong>
                  <StatusBadge status={agent.lifecycleStatus} />
                </div>
                <p className="muted">{agent.description}</p>
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
