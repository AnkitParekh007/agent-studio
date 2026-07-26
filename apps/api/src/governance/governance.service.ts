import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  knowledgeSources,
  mcpServers,
  newId,
  skills,
} from '@agent-studio/database';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, type Db } from '../core/tokens.js';

@Injectable()
export class GovernanceService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  listSkills(organizationId: string) {
    return this.db
      .select()
      .from(skills)
      .where(eq(skills.organizationId, organizationId))
      .orderBy(desc(skills.updatedAt));
  }

  async createSkill(
    ctx: RequestContext,
    input: {
      key: string;
      name: string;
      description?: string;
      promptFragment?: string;
      toolNames?: string[];
    },
  ) {
    const id = newId('skill');
    const now = new Date();
    await this.db.insert(skills).values({
      id,
      organizationId: ctx.organizationId,
      key: input.key,
      name: input.name,
      description: input.description ?? '',
      promptFragment: input.promptFragment ?? '',
      toolNamesJson: JSON.stringify(input.toolNames ?? []),
      createdAt: now,
      updatedAt: now,
    });
    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'skill.created',
      resourceType: 'skill',
      resourceId: id,
      metadata: { key: input.key },
    });
    return this.getSkill(ctx.organizationId, id);
  }

  async getSkill(organizationId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(skills)
      .where(and(eq(skills.id, id), eq(skills.organizationId, organizationId)))
      .limit(1);
    if (!row) throw new NotFoundException('Skill not found');
    return {
      ...row,
      toolNames: JSON.parse(row.toolNamesJson || '[]') as string[],
    };
  }

  listMcpServers(organizationId: string) {
    return this.db
      .select({
        id: mcpServers.id,
        organizationId: mcpServers.organizationId,
        key: mcpServers.key,
        name: mcpServers.name,
        description: mcpServers.description,
        transport: mcpServers.transport,
        endpointUrl: mcpServers.endpointUrl,
        secretReferenceId: mcpServers.secretReferenceId,
        metadataJson: mcpServers.metadataJson,
        createdAt: mcpServers.createdAt,
        updatedAt: mcpServers.updatedAt,
      })
      .from(mcpServers)
      .where(eq(mcpServers.organizationId, organizationId))
      .orderBy(desc(mcpServers.updatedAt));
  }

  async createMcpServer(
    ctx: RequestContext,
    input: {
      key: string;
      name: string;
      description?: string;
      transport?: string;
      endpointUrl: string;
      secretReferenceId?: string | null;
    },
  ) {
    if (!input.endpointUrl.startsWith('http://') && !input.endpointUrl.startsWith('https://')) {
      throw new BadRequestException('endpointUrl must be http(s)');
    }
    const id = newId('mcp');
    const now = new Date();
    await this.db.insert(mcpServers).values({
      id,
      organizationId: ctx.organizationId,
      key: input.key,
      name: input.name,
      description: input.description ?? '',
      transport: input.transport ?? 'http',
      endpointUrl: input.endpointUrl,
      secretReferenceId: input.secretReferenceId ?? null,
      metadataJson: '{}',
      createdAt: now,
      updatedAt: now,
    });
    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'mcp_server.created',
      resourceType: 'mcp_server',
      resourceId: id,
      metadata: { key: input.key },
    });
    const rows = await this.listMcpServers(ctx.organizationId);
    const row = rows.find((r) => r.id === id);
    if (!row) throw new NotFoundException('MCP server not found after create');
    return row;
  }

  listKnowledgeSources(organizationId: string) {
    return this.db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.organizationId, organizationId))
      .orderBy(desc(knowledgeSources.updatedAt));
  }

  async createKnowledgeSource(
    ctx: RequestContext,
    input: {
      key: string;
      name: string;
      description?: string;
      sourceType?: string;
      uri: string;
    },
  ) {
    const id = newId('know');
    const now = new Date();
    await this.db.insert(knowledgeSources).values({
      id,
      organizationId: ctx.organizationId,
      key: input.key,
      name: input.name,
      description: input.description ?? '',
      sourceType: input.sourceType ?? 'url',
      uri: input.uri,
      metadataJson: '{}',
      createdAt: now,
      updatedAt: now,
    });
    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'knowledge_source.created',
      resourceType: 'knowledge_source',
      resourceId: id,
      metadata: { key: input.key },
    });
    const [row] = await this.db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, id))
      .limit(1);
    return row;
  }

  async resolveAttachments(
    organizationId: string,
    ids: { skillIds?: string[]; mcpServerIds?: string[]; knowledgeSourceIds?: string[] },
  ) {
    const skillRows =
      ids.skillIds?.length
        ? await this.db
            .select()
            .from(skills)
            .where(and(eq(skills.organizationId, organizationId), inArray(skills.id, ids.skillIds)))
        : [];
    const mcpRows =
      ids.mcpServerIds?.length
        ? await this.db
            .select()
            .from(mcpServers)
            .where(
              and(
                eq(mcpServers.organizationId, organizationId),
                inArray(mcpServers.id, ids.mcpServerIds),
              ),
            )
        : [];
    const knowledgeRows =
      ids.knowledgeSourceIds?.length
        ? await this.db
            .select()
            .from(knowledgeSources)
            .where(
              and(
                eq(knowledgeSources.organizationId, organizationId),
                inArray(knowledgeSources.id, ids.knowledgeSourceIds),
              ),
            )
        : [];

    return {
      skills: skillRows.map((s) => ({
        id: s.id,
        name: s.name,
        promptFragment: s.promptFragment,
        toolNames: JSON.parse(s.toolNamesJson || '[]') as string[],
      })),
      mcpServers: mcpRows.map((m) => ({
        id: m.id,
        name: m.name,
        endpointUrl: m.endpointUrl,
        transport: m.transport,
        // Never return secret material — only whether a secret is linked.
        hasSecretReference: Boolean(m.secretReferenceId),
      })),
      knowledgeSources: knowledgeRows.map((k) => ({
        id: k.id,
        name: k.name,
        uri: k.uri,
        description: k.description,
        sourceType: k.sourceType,
      })),
    };
  }
}
