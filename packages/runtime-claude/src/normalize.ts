import { randomUUID } from 'node:crypto';
import type { AgentRuntimeEvent } from '@agent-studio/runtime-core';

export function normalizeClaudeEvent(
  raw: Record<string, unknown>,
  sequence: number,
): AgentRuntimeEvent {
  const type = String(raw.type ?? raw.event_type ?? 'message.delta');
  let mapped: AgentRuntimeEvent['type'] = 'message.delta';
  if (type.includes('error')) mapped = 'error';
  else if (type.includes('tool')) mapped = 'tool.started';
  else if (type.includes('message') || type.includes('agent.message')) mapped = 'message.delta';
  else if (type.includes('session') && type.includes('end')) mapped = 'session.ended';

  return {
    id: randomUUID(),
    type: mapped,
    sequence,
    timestamp: new Date().toISOString(),
    payload: raw,
    providerEventId: typeof raw.id === 'string' ? raw.id : undefined,
  };
}
