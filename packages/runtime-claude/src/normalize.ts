import { randomUUID } from 'node:crypto';
import type { AgentRuntimeEvent } from '@agent-studio/runtime-core';

/** Rough Claude Sonnet-class blended estimate when provider omits priced usage. */
const USD_PER_1K_INPUT = 0.003;
const USD_PER_1K_OUTPUT = 0.015;

function num(...values: unknown[]): number {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return 0;
}

function extractTokenCounts(raw: Record<string, unknown>): {
  inputTokens: number;
  outputTokens: number;
} {
  const usage =
    raw.usage && typeof raw.usage === 'object'
      ? (raw.usage as Record<string, unknown>)
      : raw.message &&
          typeof raw.message === 'object' &&
          (raw.message as Record<string, unknown>).usage &&
          typeof (raw.message as Record<string, unknown>).usage === 'object'
        ? ((raw.message as Record<string, unknown>).usage as Record<string, unknown>)
        : raw;

  return {
    inputTokens: num(
      usage.input_tokens,
      usage.inputTokens,
      usage.prompt_tokens,
      raw.input_tokens,
      raw.inputTokens,
    ),
    outputTokens: num(
      usage.output_tokens,
      usage.outputTokens,
      usage.completion_tokens,
      raw.output_tokens,
      raw.outputTokens,
    ),
  };
}

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * USD_PER_1K_INPUT + (outputTokens / 1000) * USD_PER_1K_OUTPUT;
}

export function normalizeClaudeEvent(
  raw: Record<string, unknown>,
  sequence: number,
): AgentRuntimeEvent {
  const type = String(raw.type ?? raw.event_type ?? 'message.delta');
  let mapped: AgentRuntimeEvent['type'] = 'message.delta';
  if (type.includes('error')) mapped = 'error';
  else if (type.includes('usage') || type.includes('token')) mapped = 'usage';
  else if (type.includes('tool')) mapped = 'tool.started';
  else if (type.includes('message') || type.includes('agent.message')) mapped = 'message.delta';
  else if (type.includes('session') && type.includes('end')) mapped = 'session.ended';

  const { inputTokens, outputTokens } = extractTokenCounts(raw);
  if (mapped !== 'usage' && (inputTokens > 0 || outputTokens > 0)) {
    mapped = 'usage';
  }

  const payload: Record<string, unknown> = { ...raw };
  if (mapped === 'usage') {
    payload.inputTokens = inputTokens;
    payload.outputTokens = outputTokens;
    payload.toolCallCount = num(raw.tool_call_count, raw.toolCallCount);
    payload.estimatedCostUsd = estimateCostUsd(inputTokens, outputTokens);
  }
  if (mapped === 'tool.started') {
    payload.toolName = String(
      raw.tool_name ?? raw.toolName ?? raw.name ?? (raw.tool as { name?: string } | undefined)?.name ?? 'unknown',
    );
  }

  return {
    id: randomUUID(),
    type: mapped,
    sequence,
    timestamp: new Date().toISOString(),
    payload,
    providerEventId: typeof raw.id === 'string' ? raw.id : undefined,
  };
}
