'use client';

import { Button, Panel, StatusBadge } from '@agent-studio/ui';
import { useEffect, useMemo, useState } from 'react';
import { client } from '@/lib/api';

type Agent = {
  id: string;
  name: string;
  slug: string;
  lifecycleStatus: string;
  currentDraftVersionId?: string | null;
  currentApprovedVersionId?: string | null;
};

type Version = {
  id: string;
  versionNumber: number;
  status: string;
};

type ChatLine = { role: 'user' | 'assistant'; text: string };
type TimelineItem = {
  id: string;
  type: string;
  summary: string;
  raw: Record<string, unknown>;
};

function orgId() {
  return localStorage.getItem('as_org_id') ?? '';
}

export default function PlaygroundPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [agentId, setAgentId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [usage, setUsage] = useState({ inputTokens: 0, outputTokens: 0, toolCallCount: 0 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    runtimeProvider?: string;
    developmentOnly?: boolean;
    versionStatus?: string;
    versionNumber?: number;
    correlationId?: string;
    starterPrompts?: string[];
  }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [lastPrompt, setLastPrompt] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('agentId');
    void client
      .listAgents(orgId())
      .then((rows) => {
        const list = rows as Agent[];
        setAgents(list);
        if (fromQuery && list.some((a) => a.id === fromQuery)) {
          setAgentId(fromQuery);
        } else if (list[0]) {
          setAgentId(list[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load agents'));
  }, []);

  useEffect(() => {
    if (!agentId) return;
    void client
      .listVersions(orgId(), agentId)
      .then((rows) => {
        const list = rows as Version[];
        setVersions(list);
        const preferred =
          list.find((v) => v.status === 'draft') ??
          list.find((v) => v.status === 'approved') ??
          list[0];
        setVersionId(preferred?.id ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load versions'));
  }, [agentId]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === versionId),
    [versions, versionId],
  );

  function resetConversation() {
    setLines([]);
    setTimeline([]);
    setUsage({ inputTokens: 0, outputTokens: 0, toolCallCount: 0 });
    setSessionId(null);
    setMeta({});
    setError(null);
  }

  async function stop() {
    if (!sessionId) return;
    try {
      await client.cancelPlayground(orgId(), sessionId);
      setTimeline((prev) => [
        ...prev,
        {
          id: `stop-${Date.now()}`,
          type: 'session.cancelled',
          summary: 'Execution stopped',
          raw: {},
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stop failed');
    } finally {
      setBusy(false);
    }
  }

  async function runPrompt(text: string, opts?: { retry?: boolean }) {
    if (!agentId || !versionId || !text.trim()) return;
    setBusy(true);
    setError(null);
    setLastPrompt(text);
    if (!opts?.retry) {
      setLines((prev) => [...prev, { role: 'user', text }]);
    } else {
      setLines((prev) => [...prev, { role: 'user', text: `(retry) ${text}` }]);
    }
    setInput('');

    let assistant = '';
    try {
      const started = await client.startPlayground(orgId(), {
        agentId,
        versionId,
        message: text,
      });
      setSessionId(started.sessionId);
      setMeta({
        runtimeProvider: started.runtimeProvider,
        developmentOnly: started.developmentOnly,
        versionStatus: started.versionStatus,
        versionNumber: started.versionNumber,
        correlationId: started.correlationId,
        starterPrompts: started.starterPrompts,
      });

      await client.streamPlayground(orgId(), started.sessionId, (eventType, data) => {
        const payload = (data.payload as Record<string, unknown> | undefined) ?? data;
        const id = String(data.id ?? `${eventType}-${Date.now()}-${Math.random()}`);

        if (eventType === 'message.delta' && typeof payload.text === 'string') {
          assistant += payload.text;
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

        if (eventType === 'message.completed' && typeof payload.text === 'string' && !assistant) {
          assistant = payload.text;
          setLines((prev) => [...prev, { role: 'assistant', text: assistant }]);
        }

        if (eventType === 'usage') {
          setUsage((prev) => ({
            inputTokens: prev.inputTokens + Number(payload.inputTokens ?? 0),
            outputTokens: prev.outputTokens + Number(payload.outputTokens ?? 0),
            toolCallCount: prev.toolCallCount + Number(payload.toolCallCount ?? 0),
          }));
        }

        if (eventType === 'error') {
          setError(String(payload.message ?? data.message ?? 'Runtime error'));
        }

        const summary =
          eventType === 'tool.started'
            ? `Tool started: ${String(payload.toolName ?? 'tool')}`
            : eventType === 'tool.completed'
              ? `Tool completed: ${String(payload.toolName ?? 'tool')}`
              : eventType === 'message.completed'
                ? 'Assistant message completed'
                : eventType === 'usage'
                  ? `Usage +${String(payload.inputTokens ?? 0)} in / +${String(payload.outputTokens ?? 0)} out`
                  : eventType;

        setTimeline((prev) => [...prev, { id, type: eventType, summary, raw: data }]);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playground run failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0 }}>Playground</h1>
          <p className="muted">Test draft or approved versions with streaming execution feedback.</p>
        </div>
        <Button variant="secondary" onClick={resetConversation}>
          Reset session
        </Button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <Panel title="Configuration">
        <div className="stack">
          <div className="row" style={{ alignItems: 'stretch' }}>
            <label style={{ flex: 1 }}>
              Agent
              <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Version
              <select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNumber} ({version.status})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            {selectedVersion ? <StatusBadge status={selectedVersion.status} /> : null}
            {meta.runtimeProvider ? (
              <span className="muted">
                Runtime: {meta.runtimeProvider}
                {meta.developmentOnly ? ' (development-only)' : ''}
              </span>
            ) : null}
            {meta.correlationId ? (
              <span className="muted">corr: {meta.correlationId}</span>
            ) : null}
          </div>
        </div>
      </Panel>

      <div className="playground-grid">
        <Panel title="Conversation">
          <div className="stack">
            {(meta.starterPrompts?.length ? meta.starterPrompts : ['What can you help with?']).map(
              (prompt) => (
                <button
                  key={prompt}
                  className="card-link"
                  disabled={busy || !agentId || !versionId}
                  onClick={() => void runPrompt(prompt)}
                >
                  {prompt}
                </button>
              ),
            )}

            <div className="chat-log">
              {lines.length === 0 ? (
                <p className="muted">Send a message to start a playground session.</p>
              ) : (
                lines.map((line, idx) => (
                  <div
                    key={`${line.role}-${idx}`}
                    className={line.role === 'user' ? 'bubble user' : 'bubble assistant'}
                  >
                    {line.text}
                  </div>
                ))
              )}
            </div>

            <div className="row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the agent…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void runPrompt(input);
                  }
                }}
                disabled={busy}
              />
              <Button onClick={() => void runPrompt(input)} disabled={busy || !input.trim()}>
                {busy ? 'Running…' : 'Send'}
              </Button>
              <Button variant="secondary" onClick={() => void stop()} disabled={!busy && !sessionId}>
                Stop
              </Button>
              <Button
                variant="secondary"
                onClick={() => void runPrompt(lastPrompt, { retry: true })}
                disabled={busy || !lastPrompt}
              >
                Retry
              </Button>
            </div>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Usage">
            <div className="row">
              <span>In: {usage.inputTokens}</span>
              <span>Out: {usage.outputTokens}</span>
              <span>Tools: {usage.toolCallCount}</span>
            </div>
          </Panel>

          <Panel title="Execution timeline">
            <div className="stack">
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setShowDiagnostics((v) => !v)}>
                  {showDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
                </Button>
              </div>
              <ul className="list">
                {timeline.length === 0 ? <p className="muted">No events yet.</p> : null}
                {timeline.map((item) => (
                  <li key={item.id} className="timeline-item">
                    <div className="row">
                      <StatusBadge status={item.type} />
                      <span>{item.summary}</span>
                    </div>
                    {showDiagnostics ? (
                      <pre className="pre">{JSON.stringify(item.raw, null, 2)}</pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
