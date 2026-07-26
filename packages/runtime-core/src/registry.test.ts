import { describe, expect, it } from 'vitest';
import { RuntimeProviderRegistry } from './registry.js';
import type { AgentRuntimeAdapter } from './types.js';

const stub: AgentRuntimeAdapter = {
  name: 'local',
  async validateConfiguration() {
    return { ok: true, errors: [] };
  },
  async provisionDeployment() {
    return {
      id: 'd1',
      providerAgentId: 'a1',
      providerEnvironmentId: 'e1',
      status: 'ready',
    };
  },
  async updateDeployment() {
    return {
      id: 'd1',
      providerAgentId: 'a1',
      providerEnvironmentId: 'e1',
      status: 'ready',
    };
  },
  async startSession() {
    return { id: 's1', providerSessionId: 'ps1', status: 'active' };
  },
  async *streamSessionEvents() {},
  async submitSessionInput() {},
  async approveAction() {},
  async cancelSession() {},
  async getUsage() {
    return { inputTokens: 0, outputTokens: 0, toolCallCount: 0, estimatedCostUsd: 0 };
  },
  async terminateDeployment() {},
};

describe('RuntimeProviderRegistry', () => {
  it('returns registered adapter', () => {
    const registry = new RuntimeProviderRegistry();
    registry.register(stub);
    expect(registry.get('local').name).toBe('local');
  });

  it('throws when missing', () => {
    const registry = new RuntimeProviderRegistry();
    expect(() => registry.get('claude')).toThrow(/not registered/);
  });
});
