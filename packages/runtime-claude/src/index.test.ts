import { describe, expect, it } from 'vitest';
import { ClaudeRuntimeAdapter, normalizeClaudeEvent } from './index.js';

describe('ClaudeRuntimeAdapter', () => {
  it('fails closed without api key when constructed for live use', () => {
    expect(() => new ClaudeRuntimeAdapter({})).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('provisions via http client double', async () => {
    const calls: string[] = [];
    const adapter = new ClaudeRuntimeAdapter({
      http: async (req) => {
        calls.push(`${req.method} ${req.path}`);
        if (req.path === '/v1/environments') {
          return { status: 200, body: { id: 'env_1' } };
        }
        if (req.path === '/v1/agents') {
          return { status: 200, body: { id: 'agent_1' } };
        }
        return { status: 404, body: {} };
      },
    });
    const dep = await adapter.provisionDeployment({
      organizationId: 'org',
      agentVersionId: 'ver',
      configuration: { name: 'A', model: 'claude-sonnet-4-5', instructions: 'Help' },
    });
    expect(dep.providerAgentId).toBe('agent_1');
    expect(dep.providerEnvironmentId).toBe('env_1');
    expect(calls).toEqual(['POST /v1/environments', 'POST /v1/agents']);
  });
});

describe('normalizeClaudeEvent', () => {
  it('maps error types', () => {
    const event = normalizeClaudeEvent({ type: 'error', id: 'e1', message: 'boom' }, 1);
    expect(event.type).toBe('error');
    expect(event.providerEventId).toBe('e1');
  });
});
