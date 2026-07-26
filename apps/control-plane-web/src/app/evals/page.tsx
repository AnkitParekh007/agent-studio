'use client';

import { Button, Panel, StatusBadge } from '@agent-studio/ui';
import { useEffect, useState } from 'react';
import { client } from '@/lib/api';

function orgId() {
  return localStorage.getItem('as_org_id') ?? '';
}

export default function EvalsPage() {
  const [agents, setAgents] = useState<Array<Record<string, unknown>>>([]);
  const [suites, setSuites] = useState<Array<Record<string, unknown>>>([]);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('Smoke suite');
  const [prompt, setPrompt] = useState('Say hello briefly');
  const [expectContains, setExpectContains] = useState('local-dev');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [agentRows, suiteRows, runRows] = await Promise.all([
      client.listAgents(orgId()),
      client.listEvalSuites(orgId()),
      client.listEvalRuns(orgId()),
    ]);
    setAgents(agentRows);
    setSuites(suiteRows);
    setRuns(runRows);
    if (!agentId && agentRows[0]) setAgentId(String(agentRows[0].id));
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, []);

  return (
    <div className="stack">
      <h1>Evals</h1>
      <p className="muted">
        Define prompt cases against an agent version and score responses with simple contains checks.
      </p>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <Panel title="Create suite">
        <div className="stack">
          <label>
            Agent
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {String(a.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Suite name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Case prompt
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
          </label>
          <label>
            Expect contains
            <input value={expectContains} onChange={(e) => setExpectContains(e.target.value)} />
          </label>
          <Button
            disabled={!agentId || busy}
            onClick={() => {
              setBusy(true);
              void client
                .createEvalSuite(orgId(), {
                  agentId,
                  name,
                  cases: [{ name: 'case-1', prompt, expectContains }],
                })
                .then(() => {
                  setMessage('Suite created');
                  return load();
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Create failed'))
                .finally(() => setBusy(false));
            }}
          >
            Create suite
          </Button>
        </div>
      </Panel>

      <Panel title="Suites">
        <ul className="list">
          {suites.map((suite) => (
            <li key={String(suite.id)}>
              <div className="row">
                <strong>{String(suite.name)}</strong>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void client
                      .runEvalSuite(orgId(), String(suite.id))
                      .then((run) => {
                        setMessage(
                          `Run finished: ${String(run.passedCount)} passed / ${String(run.failedCount)} failed`,
                        );
                        return load();
                      })
                      .catch((err) => setError(err instanceof Error ? err.message : 'Run failed'))
                      .finally(() => setBusy(false));
                  }}
                >
                  Run
                </Button>
              </div>
              <p className="muted">{String(suite.id)}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Recent runs">
        <ul className="list">
          {runs.map((run) => (
            <li key={String(run.id)}>
              <div className="row">
                <StatusBadge status={String(run.status)} />
                <span>
                  {String(run.passedCount)} passed / {String(run.failedCount)} failed
                </span>
              </div>
              <p className="muted">{String(run.id)}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
