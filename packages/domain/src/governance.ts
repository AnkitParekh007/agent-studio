import type { AgentVersionConfig } from './agent-version.js';

export type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  toolCallCount: number;
  estimatedCostUsd: number;
};

export type BudgetCheckResult =
  | { ok: true }
  | { ok: false; reason: string; code: 'budget.maxTokens' | 'budget.maxUsd' };

export type ToolPermissionResult =
  | { ok: true }
  | { ok: false; reason: string; code: 'tool.denied' | 'tool.maxCalls' };

export function totalTokens(usage: UsageTotals): number {
  return usage.inputTokens + usage.outputTokens;
}

export function checkBudgets(
  budgets: AgentVersionConfig['budgets'],
  usage: UsageTotals,
): BudgetCheckResult {
  const tokens = totalTokens(usage);
  if (budgets.maxTokens != null && tokens > budgets.maxTokens) {
    return {
      ok: false,
      code: 'budget.maxTokens',
      reason: `Token budget exceeded (${tokens}/${budgets.maxTokens})`,
    };
  }
  if (budgets.maxUsd != null && usage.estimatedCostUsd > budgets.maxUsd) {
    return {
      ok: false,
      code: 'budget.maxUsd',
      reason: `USD budget exceeded (${usage.estimatedCostUsd}/${budgets.maxUsd})`,
    };
  }
  return { ok: true };
}

export function checkToolPermission(
  config: Pick<AgentVersionConfig, 'toolPermissions' | 'runtimeLimits'>,
  toolName: string,
  toolCallCountSoFar: number,
): ToolPermissionResult {
  const allowlist = config.toolPermissions ?? [];
  if (allowlist.length > 0 && !allowlist.includes(toolName) && !allowlist.includes('*')) {
    return {
      ok: false,
      code: 'tool.denied',
      reason: `Tool "${toolName}" is not in the version allowlist`,
    };
  }
  const max = config.runtimeLimits?.maxToolCalls ?? 50;
  if (toolCallCountSoFar >= max) {
    return {
      ok: false,
      code: 'tool.maxCalls',
      reason: `Max tool calls exceeded (${toolCallCountSoFar}/${max})`,
    };
  }
  return { ok: true };
}

export function sumUsage(rows: Array<Partial<UsageTotals>>): UsageTotals {
  return rows.reduce<UsageTotals>(
    (acc, row) => ({
      inputTokens: acc.inputTokens + Number(row.inputTokens ?? 0),
      outputTokens: acc.outputTokens + Number(row.outputTokens ?? 0),
      toolCallCount: acc.toolCallCount + Number(row.toolCallCount ?? 0),
      estimatedCostUsd: acc.estimatedCostUsd + Number(row.estimatedCostUsd ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, toolCallCount: 0, estimatedCostUsd: 0 },
  );
}

export function appendGovernanceContext(
  baseInstructions: string,
  input: {
    skills?: Array<{ name: string; promptFragment: string }>;
    knowledgeSources?: Array<{ name: string; uri: string; description?: string }>;
    mcpServers?: Array<{ name: string; endpointUrl: string }>;
  },
): string {
  const sections: string[] = [baseInstructions.trim()].filter(Boolean);
  if (input.skills?.length) {
    sections.push(
      'Skills:\n' +
        input.skills
          .map((s) => `- ${s.name}: ${s.promptFragment}`.trim())
          .join('\n'),
    );
  }
  if (input.knowledgeSources?.length) {
    sections.push(
      'Knowledge sources (server-resolved references only):\n' +
        input.knowledgeSources
          .map((k) => `- ${k.name}: ${k.uri}${k.description ? ` (${k.description})` : ''}`)
          .join('\n'),
    );
  }
  if (input.mcpServers?.length) {
    sections.push(
      'MCP servers available server-side (credentials never exposed to clients):\n' +
        input.mcpServers.map((m) => `- ${m.name}: ${m.endpointUrl}`).join('\n'),
    );
  }
  return sections.join('\n\n');
}
