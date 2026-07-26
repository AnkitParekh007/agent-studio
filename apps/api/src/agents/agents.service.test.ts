import { describe, expect, it } from 'vitest';
import {
  assertAgentLifecycleTransition,
  assertVersionStatusTransition,
} from '@agent-studio/domain';

describe('agents domain gates used by service', () => {
  it('supports submit transition', () => {
    expect(() => assertVersionStatusTransition('draft', 'waiting_for_approval')).not.toThrow();
    expect(() => assertAgentLifecycleTransition('draft', 'waiting_for_approval')).not.toThrow();
  });
});
