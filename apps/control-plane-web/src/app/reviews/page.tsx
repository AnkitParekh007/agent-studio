'use client';

import { Button, Panel, StatusBadge } from '@agent-studio/ui';
import { useEffect, useState } from 'react';
import { client } from '@/lib/api';

function orgId() {
  return localStorage.getItem('as_org_id') ?? '';
}

export default function ReviewsPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const pending = await client.pendingApprovals(orgId());
    setItems(pending);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, []);

  async function open(requestId: string) {
    const detail = await client.getApproval(orgId(), requestId);
    setSelected(detail);
  }

  async function decide(decision: 'approved' | 'rejected') {
    if (!selected) return;
    const request = selected.request as { id: string };
    try {
      await client.decide(orgId(), request.id, decision, reason || undefined);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
    }
  }

  const diff = selected?.diff as
    | {
        instructions?: { before: string; after: string };
        model?: { before: string | null; after: string };
        runtimeProvider?: { before: string | null; after: string };
      }
    | undefined;

  return (
    <div className="stack">
      <h1>Reviews</h1>
      {error ? <p className="error">{error}</p> : null}
      <Panel title="Pending">
        <ul className="list">
          {items.map((item) => (
            <li key={String(item.id)}>
              <button className="card-link" onClick={() => void open(String(item.id))}>
                <div className="row">
                  <strong>{String(item.agentId)}</strong>
                  <StatusBadge status={String(item.status)} />
                </div>
              </button>
            </li>
          ))}
          {items.length === 0 ? <p className="muted">No pending reviews.</p> : null}
        </ul>
      </Panel>

      {selected ? (
        <Panel title="Version diff">
          <div className="stack">
            <div>
              <strong>Model</strong>
              <p className="muted">
                {diff?.model?.before ?? '—'} → {diff?.model?.after}
              </p>
            </div>
            <div>
              <strong>Runtime</strong>
              <p className="muted">
                {diff?.runtimeProvider?.before ?? '—'} → {diff?.runtimeProvider?.after}
              </p>
            </div>
            <div>
              <strong>Instructions (after)</strong>
              <pre className="pre">{diff?.instructions?.after}</pre>
            </div>
            <label>
              Rejection reason (required to reject)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="row">
              <Button onClick={() => void decide('approved')}>Approve</Button>
              <Button variant="secondary" onClick={() => void decide('rejected')}>
                Reject
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
