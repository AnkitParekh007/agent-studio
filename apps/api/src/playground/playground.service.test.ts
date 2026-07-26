import { describe, expect, it } from 'vitest';
import { composeInstructions, agentVersionConfigSchema } from '@agent-studio/domain';

describe('playground version config', () => {
  it('composes instructions for runtime validation input', () => {
    const config = agentVersionConfigSchema.parse({
      instructions: { purpose: 'Help users in the playground' },
      runtimeProvider: 'local',
    });
    expect(composeInstructions(config)).toContain('Help users in the playground');
  });
});
