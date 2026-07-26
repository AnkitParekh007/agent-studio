import { describe, expect, it } from 'vitest';
import { getApplicationTemplate, listApplicationTemplates } from './templates.js';

describe('application templates', () => {
  it('includes the six required templates', () => {
    const keys = listApplicationTemplates().map((t) => t.key);
    expect(keys).toEqual([
      'general_assistant',
      'internal_knowledge_copilot',
      'developer_composer',
      'customer_support_assistant',
      'data_analysis_workspace',
      'guided_workflow_assistant',
    ]);
  });

  it('returns a template by key', () => {
    expect(getApplicationTemplate('developer_composer')?.name).toBe('Developer composer');
  });
});
