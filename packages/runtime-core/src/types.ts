export type RuntimeProviderName = 'local' | 'claude';

export interface RuntimeConfiguration {
  name: string;
  model: string;
  instructions: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ProvisionDeploymentInput {
  configuration: RuntimeConfiguration;
  organizationId: string;
  agentVersionId: string;
}

export interface UpdateDeploymentInput {
  deploymentId: string;
  configuration: RuntimeConfiguration;
}

export interface RuntimeDeployment {
  id: string;
  providerAgentId: string;
  providerEnvironmentId: string;
  status: 'ready' | 'failed' | 'pending';
  raw?: Record<string, unknown>;
}

export interface StartSessionInput {
  deploymentId: string;
  providerAgentId: string;
  providerEnvironmentId: string;
  initialMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeSession {
  id: string;
  providerSessionId: string;
  status: 'active' | 'ended' | 'failed';
}

export type AgentRuntimeEventType =
  | 'session.started'
  | 'message.delta'
  | 'message.completed'
  | 'tool.started'
  | 'tool.completed'
  | 'error'
  | 'session.ended'
  | 'usage';

export interface AgentRuntimeEvent {
  id: string;
  type: AgentRuntimeEventType;
  sequence: number;
  timestamp: string;
  payload: Record<string, unknown>;
  providerEventId?: string;
}

export interface StreamSessionEventsInput {
  providerSessionId: string;
  afterSequence?: number;
}

export interface SubmitSessionInput {
  providerSessionId: string;
  text: string;
}

export interface ApproveRuntimeActionInput {
  providerSessionId: string;
  actionId: string;
  approved: boolean;
}

export interface RuntimeUsageInput {
  providerSessionId: string;
}

export interface RuntimeUsage {
  inputTokens: number;
  outputTokens: number;
  toolCallCount: number;
  estimatedCostUsd: number;
}

export interface AgentRuntimeAdapter {
  readonly name: RuntimeProviderName;
  validateConfiguration(configuration: RuntimeConfiguration): Promise<ValidationResult>;
  provisionDeployment(input: ProvisionDeploymentInput): Promise<RuntimeDeployment>;
  updateDeployment(input: UpdateDeploymentInput): Promise<RuntimeDeployment>;
  startSession(input: StartSessionInput): Promise<RuntimeSession>;
  streamSessionEvents(input: StreamSessionEventsInput): AsyncIterable<AgentRuntimeEvent>;
  submitSessionInput(input: SubmitSessionInput): Promise<void>;
  approveAction(input: ApproveRuntimeActionInput): Promise<void>;
  cancelSession(sessionId: string): Promise<void>;
  getUsage(input: RuntimeUsageInput): Promise<RuntimeUsage>;
  terminateDeployment(deploymentId: string): Promise<void>;
}

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigurationError';
  }
}

export class RuntimeProviderError extends Error {
  readonly provider: RuntimeProviderName;

  constructor(message: string, provider: RuntimeProviderName, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RuntimeProviderError';
    this.provider = provider;
  }
}
