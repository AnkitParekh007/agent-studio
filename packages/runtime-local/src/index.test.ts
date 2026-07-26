import { describe, expect, it } from 'vitest';
import { LocalRuntimeAdapter } from './index.js';

describe('LocalRuntimeAdapter', () => {
  it('blocks in production', async () => {
    const adapter = new LocalRuntimeAdapter({ allowLocal: true, nodeEnv: 'production' });
    await expect(
      adapter.validateConfiguration({ name: 'a', model: 'm', instructions: 'i' }),
    ).rejects.toThrow(/blocked/);
  });

  it('streams a deterministic reply', async () => {
    const adapter = new LocalRuntimeAdapter({ allowLocal: true, nodeEnv: 'development' });
    const dep = await adapter.provisionDeployment({
      organizationId: 'org',
      agentVersionId: 'ver',
      configuration: { name: 'Demo', model: 'local', instructions: 'Be helpful' },
    });
    const session = await adapter.startSession({
      deploymentId: dep.id,
      providerAgentId: dep.providerAgentId,
      providerEnvironmentId: dep.providerEnvironmentId,
      initialMessage: 'Hello',
    });
    const events = [];
    for await (const event of adapter.streamSessionEvents({
      providerSessionId: session.providerSessionId,
    })) {
      events.push(event);
      if (event.type === 'session.ended') break;
    }
    expect(events.some((e) => e.type === 'tool.started')).toBe(true);
    expect(events.some((e) => e.type === 'message.completed')).toBe(true);
  });
});
