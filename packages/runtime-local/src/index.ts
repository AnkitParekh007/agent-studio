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

export type LocalToolCallHandler = (
  toolName: string,
  input: Record<string, unknown>,
  context: { organizationId?: string },
) => Promise<Record<string, unknown>>;

interface LocalSession {
  providerSessionId: string;
  pendingMessages: string[];
  sequence: number;
  cancelled: boolean;
  organizationId?: string;
}

/**
 * Development-only runtime adapter.
 * Blocked unless allowLocal=true and nodeEnv !== 'production'.
 */
export class LocalRuntimeAdapter implements AgentRuntimeAdapter {
  readonly name = 'local' as const;
  private readonly deployments = new Map<string, RuntimeDeployment>();
  private readonly sessions = new Map<string, LocalSession>();
  private toolCallHandler?: LocalToolCallHandler;

  constructor(
    private readonly options: {
      allowLocal: boolean;
      nodeEnv: string;
    },
  ) {}

  setToolCallHandler(handler: LocalToolCallHandler) {
    this.toolCallHandler = handler;
  }

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
    const organizationId =
      typeof input.metadata?.organizationId === 'string'
        ? input.metadata.organizationId
        : undefined;
    this.sessions.set(providerSessionId, {
      providerSessionId,
      pendingMessages: input.initialMessage ? [input.initialMessage] : [],
      sequence: 0,
      cancelled: false,
      organizationId,
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

      const mcpCall = parseMcpInvocation(next);
      if (mcpCall && this.toolCallHandler) {
        const toolName = mcpCall.qualifiedName;
        yield {
          id: randomUUID(),
          type: 'tool.started',
          sequence: ++session.sequence,
          timestamp: new Date().toISOString(),
          payload: { toolName, input: mcpCall.args },
        };
        let output: Record<string, unknown>;
        try {
          output = await this.toolCallHandler(toolName, mcpCall.args, {
            organizationId: session.organizationId,
          });
        } catch (err) {
          output = {
            error: err instanceof Error ? err.message : 'mcp tool failed',
          };
        }
        yield {
          id: randomUUID(),
          type: 'tool.completed',
          sequence: ++session.sequence,
          timestamp: new Date().toISOString(),
          payload: { toolName, output },
        };
        const reply = `[local-dev] MCP ${toolName}: ${JSON.stringify(output)}`;
        yield* this.emitText(session, reply);
        yield* this.emitUsage(session, next, reply, 1);
        await new Promise((r) => setTimeout(r, 50));
        if (session.pendingMessages.length === 0) {
          yield {
            id: randomUUID(),
            type: 'session.ended',
            sequence: ++session.sequence,
            timestamp: new Date().toISOString(),
            payload: {},
          };
          break;
        }
        continue;
      }

      const toolName = 'local.echo';
      yield {
        id: randomUUID(),
        type: 'tool.started',
        sequence: ++session.sequence,
        timestamp: new Date().toISOString(),
        payload: { toolName, input: { text: next } },
      };
      await new Promise((r) => setTimeout(r, 30));
      yield {
        id: randomUUID(),
        type: 'tool.completed',
        sequence: ++session.sequence,
        timestamp: new Date().toISOString(),
        payload: { toolName, output: { echoed: next } },
      };

      const reply = `[local-dev] Echo: ${next}`;
      yield* this.emitText(session, reply);
      yield* this.emitUsage(session, next, reply, 1);
      await new Promise((r) => setTimeout(r, 50));
      if (session.pendingMessages.length === 0) {
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

  private async *emitText(session: LocalSession, reply: string) {
    for (const chunk of chunkText(reply, 24)) {
      yield {
        id: randomUUID(),
        type: 'message.delta' as const,
        sequence: ++session.sequence,
        timestamp: new Date().toISOString(),
        payload: { text: chunk },
      };
      await new Promise((r) => setTimeout(r, 20));
    }
    yield {
      id: randomUUID(),
      type: 'message.completed' as const,
      sequence: ++session.sequence,
      timestamp: new Date().toISOString(),
      payload: { text: reply },
    };
  }

  private async *emitUsage(
    session: LocalSession,
    inputText: string,
    reply: string,
    toolCallCount: number,
  ) {
    yield {
      id: randomUUID(),
      type: 'usage' as const,
      sequence: ++session.sequence,
      timestamp: new Date().toISOString(),
      payload: {
        inputTokens: inputText.length,
        outputTokens: reply.length,
        toolCallCount,
        estimatedCostUsd: 0,
      },
    };
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

function parseMcpInvocation(text: string): {
  qualifiedName: string;
  args: Record<string, unknown>;
} | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('mcp:')) return null;
  const space = trimmed.indexOf(' ');
  const qualifiedName = space === -1 ? trimmed : trimmed.slice(0, space);
  const rest = space === -1 ? '' : trimmed.slice(space + 1).trim();
  let args: Record<string, unknown> = {};
  if (rest) {
    try {
      args = JSON.parse(rest) as Record<string, unknown>;
    } catch {
      args = { input: rest };
    }
  }
  return { qualifiedName, args };
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
