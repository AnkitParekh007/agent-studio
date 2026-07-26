import { describe, expect, it } from 'vitest';
import { checkBudgets, checkToolPermission, sumUsage } from './governance.js';

describe('governance', () => {
  it('enforces token and usd budgets', () => {
    expect(checkBudgets({ maxTokens: 100 }, { inputTokens: 40, outputTokens: 50, toolCallCount: 0, estimatedCostUsd: 0 }).ok).toBe(true);
    expect(checkBudgets({ maxTokens: 100 }, { inputTokens: 60, outputTokens: 50, toolCallCount: 0, estimatedCostUsd: 0 }).ok).toBe(false);
    expect(checkBudgets({ maxUsd: 1 }, { inputTokens: 0, outputTokens: 0, toolCallCount: 0, estimatedCostUsd: 1.01 }).ok).toBe(false);
  });

  it('enforces tool allowlist and max calls', () => {
    expect(checkToolPermission({ toolPermissions: ['local.echo'], runtimeLimits: { timeoutSeconds: 300, maxToolCalls: 2 } }, 'local.echo', 0).ok).toBe(true);
    expect(checkToolPermission({ toolPermissions: ['search'], runtimeLimits: { timeoutSeconds: 300, maxToolCalls: 2 } }, 'local.echo', 0).ok).toBe(false);
    expect(checkToolPermission({ toolPermissions: [], runtimeLimits: { timeoutSeconds: 300, maxToolCalls: 1 } }, 'local.echo', 1).ok).toBe(false);
    expect(checkToolPermission({ toolPermissions: ['*'], runtimeLimits: { timeoutSeconds: 300, maxToolCalls: 5 } }, 'any.tool', 0).ok).toBe(true);
  });

  it('sums usage rows', () => {
    const totals = sumUsage([
      { inputTokens: 1, outputTokens: 2, toolCallCount: 1, estimatedCostUsd: 0.1 },
      { inputTokens: 3, outputTokens: 4, toolCallCount: 2, estimatedCostUsd: 0.2 },
    ]);
    expect(totals.inputTokens).toBe(4);
    expect(totals.outputTokens).toBe(6);
    expect(totals.toolCallCount).toBe(3);
    expect(totals.estimatedCostUsd).toBeCloseTo(0.3);
  });
});
