'use client';

import { Button, Panel, StatusBadge } from '@agent-studio/ui';
import { useEffect, useState } from 'react';
import { client } from '@/lib/api';

type Agent = { id: string; name: string; lifecycleStatus: string };
type Template = { key: string; name: string; description: string };
type AppRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  templateKey: string;
  description: string;
};

function orgId() {
  return localStorage.getItem('as_org_id') ?? '';
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [agentId, setAgentId] = useState('');
  const [templateKey, setTemplateKey] = useState('general_assistant');
  const [name, setName] = useState('Support Concierge');
  const [slug, setSlug] = useState('support-concierge');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [appRows, agentRows, templateRows] = await Promise.all([
      client.listApplications(orgId()),
      client.listAgents(orgId()),
      client.listApplicationTemplates(orgId()),
    ]);
    setApps(appRows as AppRow[]);
    const approved = (agentRows as Agent[]).filter((a) => a.lifecycleStatus === 'active');
    setAgents(approved.length ? approved : (agentRows as Agent[]));
    setTemplates(templateRows);
    if (!agentId && (approved[0] || agentRows[0])) {
      setAgentId(String((approved[0] ?? agentRows[0])?.id ?? ''));
    }
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, []);

  async function create() {
    try {
      const created = await client.createApplication(orgId(), {
        agentId,
        name,
        slug,
        description,
        templateKey,
      });
      window.location.href = `/applications/${String(created.id)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  return (
    <div className="stack">
      <h1>Application Studio</h1>
      <p className="muted">
        Turn approved agents into branded hosted applications using studio templates.
      </p>
      {error ? <p className="error">{error}</p> : null}

      <Panel title="Create from template">
        <div className="stack">
          <label>
            Approved agent
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.lifecycleStatus})
                </option>
              ))}
            </select>
          </label>
          <label>
            Template
            <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              {templates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          {templates.find((t) => t.key === templateKey) ? (
            <p className="muted">{templates.find((t) => t.key === templateKey)?.description}</p>
          ) : null}
          <label>
            Application name
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
          <Button onClick={create} disabled={!agentId}>
            Create application draft
          </Button>
        </div>
      </Panel>

      <Panel title="Applications">
        <ul className="list">
          {apps.map((app) => (
            <li key={app.id}>
              <a className="card-link" href={`/applications/${app.id}`}>
                <div className="row">
                  <strong>{app.name}</strong>
                  <StatusBadge status={app.status} />
                </div>
                <p className="muted">
                  {app.slug} · template {app.templateKey}
                </p>
              </a>
            </li>
          ))}
          {apps.length === 0 ? <p className="muted">No applications yet.</p> : null}
        </ul>
      </Panel>
    </div>
  );
}
