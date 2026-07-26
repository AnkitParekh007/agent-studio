import { describe, expect, it } from 'vitest';
import { fetchKnowledgeSource } from './knowledge.js';

describe('fetchKnowledgeSource', () => {
  it('supports inline text: URIs', async () => {
    const result = await fetchKnowledgeSource({
      name: 'policy',
      uri: 'text:Refunds within 30 days.',
    });
    expect(result.content).toContain('Refunds');
    expect(result.error).toBeUndefined();
  });
});
