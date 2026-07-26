import { Inject, Injectable } from '@nestjs/common';
import {
  fetchKnowledgeSources,
  mcpCallTool,
  mcpListTools,
  type McpTool,
} from '@agent-studio/integrations';
import { mcpServers, knowledgeSources, secretValues } from '@agent-studio/database';
import { decryptSecret } from '@agent-studio/domain';
import { and, eq, inArray } from 'drizzle-orm';
import { DB, ENV, type Db, type Env } from '../core/tokens.js';
import { MetricsService } from '../core/metrics.service.js';
import { logWarn } from '../core/logger.js';

export type LiveMcpTool = McpTool & {
  serverId: string;
  serverKey: string;
  serverName: string;
  qualifiedName: string;
};

@Injectable()
export class RuntimeContextService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async buildLiveContext(
    organizationId: string,
    ids: { mcpServerIds?: string[]; knowledgeSourceIds?: string[] },
  ) {
    const knowledge = await this.retrieveKnowledge(organizationId, ids.knowledgeSourceIds ?? []);
    const mcpTools = await this.listMcpTools(organizationId, ids.mcpServerIds ?? []);
    return { knowledge, mcpTools };
  }

  async retrieveKnowledge(organizationId: string, knowledgeSourceIds: string[]) {
    if (!knowledgeSourceIds.length) return [];
    const rows = await this.db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.organizationId, organizationId),
          inArray(knowledgeSources.id, knowledgeSourceIds),
        ),
      );
    const fetched = await fetchKnowledgeSources(
      rows.map((r) => ({ name: r.name, uri: r.uri })),
    );
    this.metrics.increment('knowledge_fetches', fetched.length);
    return fetched;
  }

  async listMcpTools(organizationId: string, mcpServerIds: string[]): Promise<LiveMcpTool[]> {
    if (!mcpServerIds.length) return [];
    const rows = await this.db
      .select()
      .from(mcpServers)
      .where(
        and(eq(mcpServers.organizationId, organizationId), inArray(mcpServers.id, mcpServerIds)),
      );

    const tools: LiveMcpTool[] = [];
    for (const server of rows) {
      try {
        const authToken = await this.resolveAuthToken(server.secretReferenceId);
        const listed = await mcpListTools({
          endpointUrl: server.endpointUrl,
          authToken,
        });
        for (const tool of listed) {
          tools.push({
            ...tool,
            serverId: server.id,
            serverKey: server.key,
            serverName: server.name,
            qualifiedName: `mcp:${server.key}.${tool.name}`,
          });
        }
        this.metrics.increment('mcp_tools_listed', listed.length);
      } catch (err) {
        logWarn('mcp_list_tools_failed', {
          organizationId,
          serverId: server.id,
          message: err instanceof Error ? err.message : String(err),
        });
        this.metrics.increment('mcp_list_tools_errors');
      }
    }
    return tools;
  }

  async callMcpTool(
    organizationId: string,
    qualifiedOrServerKey: string,
    toolName: string | undefined,
    args: Record<string, unknown>,
  ) {
    let serverKey = qualifiedOrServerKey;
    let name = toolName;
    if (qualifiedOrServerKey.startsWith('mcp:')) {
      const rest = qualifiedOrServerKey.slice(4);
      const dot = rest.indexOf('.');
      if (dot > 0) {
        serverKey = rest.slice(0, dot);
        name = rest.slice(dot + 1);
      }
    }
    if (!name) throw new Error('MCP tool name is required');

    const [server] = await this.db
      .select()
      .from(mcpServers)
      .where(and(eq(mcpServers.organizationId, organizationId), eq(mcpServers.key, serverKey)))
      .limit(1);
    if (!server) throw new Error(`MCP server not found: ${serverKey}`);

    const authToken = await this.resolveAuthToken(server.secretReferenceId);
    this.metrics.increment('mcp_tool_calls');
    try {
      const result = await mcpCallTool(
        { endpointUrl: server.endpointUrl, authToken },
        name,
        args,
      );
      return { serverKey, toolName: name, result };
    } catch (err) {
      this.metrics.increment('mcp_tool_call_errors');
      throw err;
    }
  }

  private async resolveAuthToken(secretReferenceId: string | null): Promise<string | undefined> {
    if (!secretReferenceId) return undefined;
    const [value] = await this.db
      .select()
      .from(secretValues)
      .where(eq(secretValues.secretReferenceId, secretReferenceId))
      .limit(1);
    if (!value) return undefined;
    return decryptSecret(this.env.SECRETS_MASTER_KEY, {
      ciphertext: value.ciphertext,
      iv: value.iv,
      authTag: value.authTag,
    });
  }
}
