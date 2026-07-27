import { Body, Controller, ForbiddenException, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { mcpServers } from '@agent-studio/database';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { DB, type Db } from '../core/tokens.js';
import { RuntimeContextService } from './runtime-context.service.js';

@Controller('api/integrations')
@UseGuards(AuthGuard, PermissionsGuard)
export class IntegrationsController {
  constructor(
    @Inject(RuntimeContextService) private readonly runtimeContext: RuntimeContextService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Post('mcp-servers/:serverKey/tools')
  @RequirePermissions('governance:manage')
  async listTools(@AuthCtx() ctx: RequestContext, @Param('serverKey') serverKey: string) {
    const [server] = await this.db
      .select()
      .from(mcpServers)
      .where(
        and(eq(mcpServers.organizationId, ctx.organizationId), eq(mcpServers.key, serverKey)),
      )
      .limit(1);
    if (!server) return [];
    return this.runtimeContext.listMcpTools(ctx.organizationId, [server.id]);
  }

  @Post('mcp/call')
  @RequirePermissions('governance:manage')
  async call(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    if (ctx.authMode === 'publication_token') {
      throw new ForbiddenException('Publication tokens cannot invoke MCP tools directly');
    }
    const input = z
      .object({
        tool: z.string().min(1),
        arguments: z.record(z.unknown()).optional(),
      })
      .parse(body);
    return this.runtimeContext.callMcpTool(
      ctx.organizationId,
      input.tool,
      undefined,
      (input.arguments ?? {}) as Record<string, unknown>,
    );
  }

  @Post('knowledge/retrieve')
  @RequirePermissions('governance:manage')
  retrieve(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z.object({ knowledgeSourceIds: z.array(z.string()).min(1) }).parse(body);
    return this.runtimeContext.retrieveKnowledge(ctx.organizationId, input.knowledgeSourceIds);
  }
}
