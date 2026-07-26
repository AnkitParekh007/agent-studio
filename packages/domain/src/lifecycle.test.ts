import { describe, expect, it } from 'vitest';
import {
  assertAgentLifecycleTransition,
  assertVersionStatusTransition,
  canTransitionVersionStatus,
} from './lifecycle.js';

describe('agent lifecycle', () => {
  it('allows draft to waiting_for_approval', () => {
    expect(() => assertAgentLifecycleTransition('draft', 'waiting_for_approval')).not.toThrow();
  });

  it('rejects terminated to active', () => {
    expect(() => assertAgentLifecycleTransition('terminated', 'active')).toThrow();
  });
});

describe('version status', () => {
  it('allows waiting_for_approval to approved', () => {
    expect(canTransitionVersionStatus('waiting_for_approval', 'approved')).toBe(true);
  });

  it('rejects approved to draft', () => {
    expect(() => assertVersionStatusTransition('approved', 'draft')).toThrow();
  });
});
