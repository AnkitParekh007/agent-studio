import { randomUUID } from 'node:crypto';
import {
  RuntimeConfigurationError,
  RuntimeProviderError,
  type AgentRuntimeAdapter,
  type AgentRuntimeEvent,
  type ApproveRuntimeActionInput,
  type ProvisionDeploymentInput,
  type RuntimeConfiguration,
  type RuntimeDeployment,
  type RuntimeSession,
  type RuntimeUsage,
  type RuntimeUsageInput,
  type StartSessionInput,
  type StreamSessionEventsInput,
  type SubmitSessionInput,
  type UpdateDeploymentInput,
  type ValidationResult,
} from '@agent-studio/runtime-core';
import { createFetchClaudeHttpClient, type ClaudeHttpClient } from './http.js';
import { estimateCostUsd, normalizeClaudeEvent } from './normalize.js';

export { createFetchClaudeHttpClient, normalizeClaudeEvent, estimateCostUsd };
export type { ClaudeHttpClient };

/**
 * Claude Managed Agents adapter.
 * Docs consulted: 2026-07-26 — beta managed-agents-2026-04-01.
 * Requires ANTHROPIC_API_KEY. Never falls back to local.
 */
export class ClaudeRuntimeAdapter implements AgentRuntimeAdapter {
  readonly name = 'claude' as const;
  private readonly http: ClaudeHttpClient;

  constructor(options: { apiKey?: string; baseUrl?: string; http?: ClaudeHttpClient }) {
    if (options.http) {
      this.http = options.http;
      return;
    }
    if (!options.apiKey) {
      throw new RuntimeConfigurationError(
        'Claude runtime adapter requires ANTHROPIC_API_KEY. Set the key to activate Managed Agents, or use the local development adapter explicitly.',
      );
    }
    this.http = createFetchClaudeHttpClient({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl ?? 'https://api.anthropic.com',
    });
  }

  async validateConfiguration(configuration: RuntimeConfiguration): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!configuration.name) errors.push('name is required');
    if (!configuration.instructions) errors.push('instructions are required');
    if (!configuration.model) errors.push('model is required');
    return { ok: errors.length === 0, errors };
  }

  async provisionDeployment(input: ProvisionDeploymentInput): Promise<RuntimeDeployment> {
    const validation = await this.validateConfiguration(input.configuration);
    if (!validation.ok) {
      throw new RuntimeConfigurationError(validation.errors.join('; '));
    }

    try {
      const envRes = await this.http({
        method: 'POST',
        path: '/v1/environments',
        body: {
          name: `agent-studio-${input.organizationId}`,
          config: { type: 'cloud' },
        },
      });
      if (envRes.status >= 400) {
        throw new RuntimeProviderError(
          `Failed to create Claude environment (${envRes.status})`,
          'claude',
          { cause: envRes.body },
        );
      }
      const envBody = envRes.body as { id?: string };
      const environmentId = envBody.id ?? `env_${randomUUID()}`;

      const agentRes = await this.http({
        method: 'POST',
        path: '/v1/agents',
        body: {
          name: input.configuration.name,
          model: input.configuration.model,
          system: input.configuration.instructions,
        },
      });
      if (agentRes.status >= 400) {
        throw new RuntimeProviderError(
          `Failed to create Claude agent (${agentRes.status})`,
          'claude',
          { cause: agentRes.body },
        );
      }
      const agentBody = agentRes.body as { id?: string };
      const providerAgentId = agentBody.id ?? `agent_${randomUUID()}`;

      return {
        id: `claude_dep_${randomUUID()}`,
        providerAgentId,
        providerEnvironmentId: environmentId,
        status: 'ready',
        raw: { agent: agentBody, environment: envBody },
      };
    } catch (err) {
      if (err instanceof RuntimeProviderError || err instanceof RuntimeConfigurationError) throw err;
      throw new RuntimeProviderError('Claude provision failed', 'claude', { cause: err });
    }
  }

  async updateDeployment(input: UpdateDeploymentInput): Promise<RuntimeDeployment> {
    const validation = await this.validateConfiguration(input.configuration);
    if (!validation.ok) {
      throw new RuntimeConfigurationError(validation.errors.join('; '));
    }
    return {
      id: input.deploymentId,
      providerAgentId: `unknown`,
      providerEnvironmentId: `unknown`,
      status: 'ready',
    };
  }

  async startSession(input: StartSessionInput): Promise<RuntimeSession> {
    const res = await this.http({
      method: 'POST',
      path: '/v1/sessions',
      body: {
        agent: input.providerAgentId,
        environment_id: input.providerEnvironmentId,
      },
    });
    if (res.status >= 400) {
      throw new RuntimeProviderError(`Failed to start Claude session (${res.status})`, 'claude', {
        cause: res.body,
      });
    }
    const body = res.body as { id?: string };
    const providerSessionId = body.id ?? `session_${randomUUID()}`;
    if (input.initialMessage) {
      await this.submitSessionInput({
        providerSessionId,
        text: input.initialMessage,
      });
    }
    return { id: providerSessionId, providerSessionId, status: 'active' };
  }

  async *streamSessionEvents(
    input: StreamSessionEventsInput,
  ): AsyncIterable<AgentRuntimeEvent> {
    // Contract-friendly polling list endpoint; SSE wiring can replace this with stream when live.
    const res = await this.http({
      method: 'GET',
      path: `/v1/sessions/${input.providerSessionId}/events`,
    });
    if (res.status >= 400) {
      yield {
        id: randomUUID(),
        type: 'error',
        sequence: (input.afterSequence ?? 0) + 1,
        timestamp: new Date().toISOString(),
        payload: { message: `Failed to list events (${res.status})`, body: res.body },
      };
      return;
    }
    const body = res.body as { data?: Record<string, unknown>[] } | Record<string, unknown>[];
    const events = Array.isArray(body) ? body : (body.data ?? []);
    let sequence = input.afterSequence ?? 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let toolCallCount = 0;
    let emittedUsage = false;
    for (const raw of events) {
      sequence += 1;
      const event = normalizeClaudeEvent(raw, sequence);
      if (event.type === 'usage') {
        inputTokens += Number(event.payload.inputTokens ?? 0);
        outputTokens += Number(event.payload.outputTokens ?? 0);
        toolCallCount += Number(event.payload.toolCallCount ?? 0);
        emittedUsage = true;
      }
      if (event.type === 'tool.started') toolCallCount += 1;
      yield event;
    }
    if (!emittedUsage && (inputTokens > 0 || outputTokens > 0 || toolCallCount > 0)) {
      sequence += 1;
      yield {
        id: randomUUID(),
        type: 'usage',
        sequence,
        timestamp: new Date().toISOString(),
        payload: {
          inputTokens,
          outputTokens,
          toolCallCount,
          estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens),
          estimated: true,
        },
      };
    }
  }

  async submitSessionInput(input: SubmitSessionInput): Promise<void> {
    const res = await this.http({
      method: 'POST',
      path: `/v1/sessions/${input.providerSessionId}/events`,
      body: {
        events: [{ type: 'user.message', content: [{ type: 'text', text: input.text }] }],
      },
    });
    if (res.status >= 400) {
      throw new RuntimeProviderError(`Failed to submit session input (${res.status})`, 'claude', {
        cause: res.body,
      });
    }
  }

  async approveAction(_input: ApproveRuntimeActionInput): Promise<void> {
    // Human approval mapping depends on specific Claude event types; reserved for later.
  }

  async cancelSession(sessionId: string): Promise<void> {
    await this.http({
      method: 'POST',
      path: `/v1/sessions/${sessionId}/archive`,
    });
  }

  async getUsage(_input: RuntimeUsageInput): Promise<RuntimeUsage> {
    // Prefer usage events persisted by the gateway from normalizeClaudeEvent estimates.
    return { inputTokens: 0, outputTokens: 0, toolCallCount: 0, estimatedCostUsd: 0 };
  }

  async terminateDeployment(_deploymentId: string): Promise<void> {
    // Platform deployment termination; Claude agent archive is intentional and irreversible — call explicitly.
  }
}

export function tryCreateClaudeAdapter(options: {
  apiKey?: string;
  baseUrl?: string;
}): ClaudeRuntimeAdapter | null {
  if (!options.apiKey) return null;
  return new ClaudeRuntimeAdapter(options);
}
