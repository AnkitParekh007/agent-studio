'use client';

import { Button, Panel } from '@agent-studio/ui';
import { useEffect, useState } from 'react';
import { client } from '@/lib/api';

function orgId() {
  return localStorage.getItem('as_org_id') ?? '';
}

export default function GovernancePage() {
  const [skills, setSkills] = useState<Array<Record<string, unknown>>>([]);
  const [mcp, setMcp] = useState<Array<Record<string, unknown>>>([]);
  const [knowledge, setKnowledge] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [skillKey, setSkillKey] = useState('summarize');
  const [skillName, setSkillName] = useState('Summarize');
  const [skillPrompt, setSkillPrompt] = useState('Produce concise bullet summaries.');

  const [mcpKey, setMcpKey] = useState('docs-mcp');
  const [mcpName, setMcpName] = useState('Docs MCP');
  const [mcpUrl, setMcpUrl] = useState('https://example.com/mcp');

  const [knowKey, setKnowKey] = useState('handbook');
  const [knowName, setKnowName] = useState('Employee handbook');
  const [knowUri, setKnowUri] = useState('https://example.com/handbook');

  async function load() {
    const [s, m, k] = await Promise.all([
      client.listSkills(orgId()),
      client.listMcpServers(orgId()),
      client.listKnowledgeSources(orgId()),
    ]);
    setSkills(s);
    setMcp(m);
    setKnowledge(k);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, []);

  return (
    <div className="stack">
      <h1>Governance</h1>
      <p className="muted">
        Org-scoped skills, MCP servers, and knowledge sources. Attach them on agent drafts; secrets
        never leave the server.
      </p>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <Panel title="Skills">
        <div className="stack">
          <label>
            Key
            <input value={skillKey} onChange={(e) => setSkillKey(e.target.value)} />
          </label>
          <label>
            Name
            <input value={skillName} onChange={(e) => setSkillName(e.target.value)} />
          </label>
          <label>
            Prompt fragment
            <textarea value={skillPrompt} onChange={(e) => setSkillPrompt(e.target.value)} rows={3} />
          </label>
          <Button
            onClick={() => {
              void client
                .createSkill(orgId(), {
                  key: skillKey,
                  name: skillName,
                  promptFragment: skillPrompt,
                })
                .then(() => {
                  setMessage('Skill created');
                  return load();
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Create failed'));
            }}
          >
            Create skill
          </Button>
          <ul className="list">
            {skills.map((s) => (
              <li key={String(s.id)}>
                <strong>{String(s.name)}</strong>
                <p className="muted">
                  {String(s.key)} · {String(s.id)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel title="MCP servers">
        <div className="stack">
          <label>
            Key
            <input value={mcpKey} onChange={(e) => setMcpKey(e.target.value)} />
          </label>
          <label>
            Name
            <input value={mcpName} onChange={(e) => setMcpName(e.target.value)} />
          </label>
          <label>
            Endpoint URL
            <input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} />
          </label>
          <Button
            onClick={() => {
              void client
                .createMcpServer(orgId(), {
                  key: mcpKey,
                  name: mcpName,
                  endpointUrl: mcpUrl,
                })
                .then(() => {
                  setMessage('MCP server registered');
                  return load();
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Create failed'));
            }}
          >
            Register MCP server
          </Button>
          <ul className="list">
            {mcp.map((s) => (
              <li key={String(s.id)}>
                <strong>{String(s.name)}</strong>
                <p className="muted">
                  {String(s.endpointUrl)} · {String(s.id)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel title="Knowledge sources">
        <div className="stack">
          <label>
            Key
            <input value={knowKey} onChange={(e) => setKnowKey(e.target.value)} />
          </label>
          <label>
            Name
            <input value={knowName} onChange={(e) => setKnowName(e.target.value)} />
          </label>
          <label>
            URI
            <input value={knowUri} onChange={(e) => setKnowUri(e.target.value)} />
          </label>
          <Button
            onClick={() => {
              void client
                .createKnowledgeSource(orgId(), {
                  key: knowKey,
                  name: knowName,
                  uri: knowUri,
                })
                .then(() => {
                  setMessage('Knowledge source registered');
                  return load();
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Create failed'));
            }}
          >
            Register knowledge source
          </Button>
          <ul className="list">
            {knowledge.map((s) => (
              <li key={String(s.id)}>
                <strong>{String(s.name)}</strong>
                <p className="muted">
                  {String(s.uri)} · {String(s.id)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </div>
  );
}
