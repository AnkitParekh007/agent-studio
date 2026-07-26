import { z } from 'zod';

export const structuredInstructionsSchema = z.object({
  purpose: z.string().default(''),
  role: z.string().default(''),
  responsibilities: z.string().default(''),
  behavioralRules: z.string().default(''),
  allowedActions: z.string().default(''),
  prohibitedActions: z.string().default(''),
  safetyRules: z.string().default(''),
  escalationRules: z.string().default(''),
  responseStyle: z.string().default(''),
  completionCriteria: z.string().default(''),
  toolUsePolicy: z.string().default(''),
  knowledgeUsePolicy: z.string().default(''),
});

export type StructuredInstructions = z.infer<typeof structuredInstructionsSchema>;

export const agentVersionConfigSchema = z.object({
  model: z.string().min(1).default('claude-sonnet-4-5'),
  runtimeProvider: z.enum(['local', 'claude']).default('local'),
  instructions: structuredInstructionsSchema.default({}),
  rawInstructions: z.string().default(''),
  starterPrompts: z.array(z.string()).default([]),
  conversationSettings: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .default({}),
  memoryPolicy: z.string().default('none'),
  artifactPolicy: z.string().default('allow'),
  toolPermissions: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()).default([]),
  knowledgeSourceIds: z.array(z.string()).default([]),
  runtimeLimits: z
    .object({
      timeoutSeconds: z.number().int().positive().default(300),
      maxToolCalls: z.number().int().positive().default(50),
    })
    .default({}),
  budgets: z
    .object({
      maxTokens: z.number().int().positive().optional(),
      maxUsd: z.number().nonnegative().optional(),
    })
    .default({}),
  applicationConfig: z
    .object({
      welcomeMessage: z.string().default('How can I help you today?'),
      theme: z
        .object({
          primaryColor: z.string().default('#0F766E'),
          backgroundColor: z.string().default('#F8FAFC'),
          fontFamily: z.string().default('IBM Plex Sans, sans-serif'),
        })
        .default({}),
    })
    .default({}),
  metadata: z.record(z.unknown()).default({}),
});

export type AgentVersionConfig = z.infer<typeof agentVersionConfigSchema>;

export function composeInstructions(config: AgentVersionConfig): string {
  if (config.rawInstructions.trim()) {
    return config.rawInstructions.trim();
  }
  const i = config.instructions;
  return [
    i.purpose && `Purpose: ${i.purpose}`,
    i.role && `Role: ${i.role}`,
    i.responsibilities && `Responsibilities: ${i.responsibilities}`,
    i.behavioralRules && `Behavioral rules: ${i.behavioralRules}`,
    i.allowedActions && `Allowed actions: ${i.allowedActions}`,
    i.prohibitedActions && `Prohibited actions: ${i.prohibitedActions}`,
    i.safetyRules && `Safety rules: ${i.safetyRules}`,
    i.escalationRules && `Escalation rules: ${i.escalationRules}`,
    i.responseStyle && `Response style: ${i.responseStyle}`,
    i.completionCriteria && `Completion criteria: ${i.completionCriteria}`,
    i.toolUsePolicy && `Tool-use policy: ${i.toolUsePolicy}`,
    i.knowledgeUsePolicy && `Knowledge-use policy: ${i.knowledgeUsePolicy}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function instructionDiff(before: string, after: string): { before: string; after: string } {
  return { before, after };
}
