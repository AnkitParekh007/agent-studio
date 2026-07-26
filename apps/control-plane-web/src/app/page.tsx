'use client';

import { Button, Panel } from '@agent-studio/ui';
import { useEffect, useState } from 'react';
import { client, type OrgRow } from '@/lib/api';

export default function HomePage() {
  const [email, setEmail] = useState('owner@example.com');
  const [password, setPassword] = useState('Password123!');
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    try {
      const data = await client.meOrgs();
      setUserName(data.user.name);
      setOrgs(data.organizations);
      if (data.organizations[0]) {
        localStorage.setItem('as_org_id', data.organizations[0].organizationId);
        localStorage.setItem('as_org_slug', data.organizations[0].slug);
      }
      setError(null);
    } catch {
      setUserName(null);
      setOrgs([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSignIn() {
    setLoading(true);
    setError(null);
    try {
      await client.signIn(email, password);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <div>
        <h1 className="hero-title">Agent Studio</h1>
        <p className="muted">Define an agent once. Govern it centrally. Publish it anywhere.</p>
      </div>

      <Panel title="Session">
        {userName ? (
          <div className="stack">
            <p>
              Signed in as <strong>{userName}</strong>
            </p>
            <ul className="list">
              {orgs.map((org) => (
                <li key={org.organizationId}>
                  {org.name} <span className="muted">({org.roleKey})</span>
                </li>
              ))}
            </ul>
            <div className="row">
              <Button onClick={() => (window.location.href = '/agents')}>Open agents</Button>
              <Button variant="secondary" onClick={() => (window.location.href = '/reviews')}>
                Open reviews
              </Button>
            </div>
          </div>
        ) : (
          <div className="stack">
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
            {error ? <p className="error">{error}</p> : null}
            <Button onClick={onSignIn} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
