import { describe, expect, it } from 'vitest';
import { assertPermission, hasPermission } from './index.js';

describe('authorization', () => {
  it('allows agent_creator to write agents', () => {
    expect(hasPermission('agent_creator', 'agent:write')).toBe(true);
  });

  it('denies end_user from approving', () => {
    expect(() => assertPermission('end_user', 'agent:approve')).toThrow(/Missing permission/);
  });
});
