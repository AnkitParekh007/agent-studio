import { randomUUID } from 'node:crypto';
import {
  RuntimeConfigurationError,
  type AgentRuntimeAdapter,
  type AgentRuntimeEvent,
  type ApproveRuntimeActionInput,
  type ProvisionDeploymentInput,
  type RuntimeDeployment,
  type RuntimeSession,
  type RuntimeUsage,
  type RuntimeUsageInput,
  type StartSessionInput,
  type StreamSessionEventsInput,
  type SubmitSessionInput,
  type UpdateDeploymentInput,
  type ValidationResult,
  type RuntimeConfiguration,
} from '@agent-studio/runtime-core';

interface LocalSession {
  providerSessionId: string;
  pendingMessages: string[];
  sequence: number;
  cancelled: boolean;
}

/**
 * Development-only runtime adapter.
 * Blocked unless allowLocal=true and nodeEnv !== 'production'.
 */
export class LocalRuntimeAdapter implements AgentRuntimeAdapter {
  readonly name = 'local' as const;
  private readonly deployments = new Map<string, RuntimeDeployment>();
  private readonly sessions = new Map<string, LocalSession>();

  constructor(
    private readonly options: {
      allowLocal: boolean;
      nodeEnv: string;
    },
  ) {}

  private assertAllowed(): void {
    if (this.options.nodeEnv === 'production') {
      throw new RuntimeConfigurationError(
        'Local runtime adapter is blocked when NODE_ENV=production',
      );
    }
    if (!this.options.allowLocal) {
      throw new RuntimeConfigurationError(
        'Local runtime adapter requires RUNTIME_ALLOW_LOCAL=true',
      );
    }
  }

  async validateConfiguration(configuration: RuntimeConfiguration): Promise<ValidationResult> {
    this.assertAllowed();
    const errors: string[] = [];
    if (!configuration.name) errors.push('name is required');
    if (!configuration.instructions) errors.push('instructions are required');
    if (!configuration.model) errors.push('model is required');
    return { ok: errors.length === 0, errors };
  }

  async provisionDeployment(input: ProvisionDeploymentInput): Promise<RuntimeDeployment> {
    this.assertAllowed();
    const validation = await this.validateConfiguration(input.configuration);
    if (!validation.ok) {
      throw new RuntimeConfigurationError(validation.errors.join('; '));
    }
    const deployment: RuntimeDeployment = {
      id: `local_dep_${randomUUID()}`,
      providerAgentId: `local_agent_${input.agentVersionId}`,
      providerEnvironmentId: `local_env_${input.organizationId}`,
      status: 'ready',
      raw: { developmentOnly: true },
    };
    this.deployments.set(deployment.id, deployment);
    return deployment;
  }

  async updateDeployment(input: UpdateDeploymentInput): Promise<RuntimeDeployment> {
    this.assertAllowed();
    const existing = this.deployments.get(input.deploymentId);
    if (!existing) {
      throw new RuntimeConfigurationError(`Unknown local deployment ${input.deploymentId}`);
    }
    return existing;
  }

  async startSession(input: StartSessionInput): Promise<RuntimeSession> {
    this.assertAllowed();
    const providerSessionId = `local_sess_${randomUUID()}`;
    this.sessions.set(providerSessionId, {
      providerSessionId,
      pendingMessages: input.initialMessage ? [input.initialMessage] : [],
      sequence: 0,
      cancelled: false,
    });
    return {
      id: providerSessionId,
      providerSessionId,
      status: 'active',
    };
  }

  async *streamSessionEvents(
    input: StreamSessionEventsInput,
  ): AsyncIterable<AgentRuntimeEvent> {
    this.assertAllowed();
    const session = this.sessions.get(input.providerSessionId);
    if (!session) {
      throw new RuntimeConfigurationError(`Unknown local session ${input.providerSessionId}`);
    }

    const started: AgentRuntimeEvent = {
      id: randomUUID(),
      type: 'session.started',
      sequence: ++session.sequence,
      timestamp: new Date().toISOString(),
      payload: { developmentOnly: true },
    };
    yield started;

    while (!session.cancelled) {
      const next = session.pendingMessages.shift();
      if (!next) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }

      const reply = `[local-dev] Echo: ${next}`;
      for (const chunk of chunkText(reply, 24)) {
        yield {
          id: randomUUID(),
          type: 'message.delta',
          sequence: ++session.sequence,
          timestamp: new Date().toISOString(),
          payload: { text: chunk },
        };
        await new Promise((r) => setTimeout(r, 20));
      }
      yield {
        id: randomUUID(),
        type: 'message.completed',
        sequence: ++session.sequence,
        timestamp: new Date().toISOString(),
        payload: { text: reply },
      };
      yield {
        id: randomUUID(),
        type: 'usage',
        sequence: ++session.sequence,
        timestamp: new Date().toISOString(),
        payload: {
          inputTokens: next.length,
          outputTokens: reply.length,
          toolCallCount: 0,
          estimatedCostUsd: 0,
        },
      };
      // After one turn in stream consumers that close, break when idle briefly
      await new Promise((r) => setTimeout(r, 50));
      if (session.pendingMessages.length === 0) {
        // keep stream open briefly then end for gateway simplicity on first message
        yield {
          id: randomUUID(),
          type: 'session.ended',
          sequence: ++session.sequence,
          timestamp: new Date().toISOString(),
          payload: {},
        };
        break;
      }
    }
  }

  async submitSessionInput(input: SubmitSessionInput): Promise<void> {
    this.assertAllowed();
    const session = this.sessions.get(input.providerSessionId);
    if (!session) {
      throw new RuntimeConfigurationError(`Unknown local session ${input.providerSessionId}`);
    }
    session.pendingMessages.push(input.text);
  }

  async approveAction(_input: ApproveRuntimeActionInput): Promise<void> {
    this.assertAllowed();
  }

  async cancelSession(sessionId: string): Promise<void> {
    this.assertAllowed();
    const session = this.sessions.get(sessionId);
    if (session) session.cancelled = true;
  }

  async getUsage(_input: RuntimeUsageInput): Promise<RuntimeUsage> {
    this.assertAllowed();
    return { inputTokens: 0, outputTokens: 0, toolCallCount: 0, estimatedCostUsd: 0 };
  }

  async terminateDeployment(deploymentId: string): Promise<void> {
    this.assertAllowed();
    this.deployments.delete(deploymentId);
  }
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
