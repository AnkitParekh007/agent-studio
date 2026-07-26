import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  getApplicationTemplate,
  listApplicationTemplates,
  parseStudioConfig,
  publicStudioConfig,
  type ApplicationStudioConfig,
} from '@agent-studio/application-templates';
import {
  agentDeployments,
  applicationDefinitions,
  newId,
  organizations,
  publicationTokens,
  publications,
} from '@agent-studio/database';
import {
  generatePublicationToken,
  hashToken,
  isPublicationChannel,
  type PublicationChannel,
} from '@agent-studio/domain';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { AgentsService } from '../agents/agents.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, ENV, type Db, type Env } from '../core/tokens.js';

function toAppRow(row: typeof applicationDefinitions.$inferSelect) {
  const studioConfig = parseStudioConfig(JSON.parse(row.studioConfigJson || '{}'));
  return {
    id: row.id,
    organizationId: row.organizationId,
    agentId: row.agentId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    logoUrl: row.logoUrl,
    templateKey: row.templateKey,
    status: row.status,
    welcomeMessage: row.welcomeMessage,
    starterPrompts: JSON.parse(row.starterPromptsJson || '[]') as string[],
    theme: JSON.parse(row.themeJson || '{}') as Record<string, string>,
    studioConfig,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  listTemplates() {
    return listApplicationTemplates().map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description,
      config: t.config,
    }));
  }

  async list(organizationId: string) {
    const rows = await this.db
      .select()
      .from(applicationDefinitions)
      .where(eq(applicationDefinitions.organizationId, organizationId))
      .orderBy(desc(applicationDefinitions.updatedAt));
    return rows.map(toAppRow);
  }

  async get(organizationId: string, applicationId: string) {
    const [row] = await this.db
      .select()
      .from(applicationDefinitions)
      .where(
        and(
          eq(applicationDefinitions.id, applicationId),
          eq(applicationDefinitions.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Application not found');

    const pubs = await this.db
      .select()
      .from(publications)
      .where(eq(publications.applicationId, applicationId))
      .orderBy(desc(publications.createdAt));

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    const activeByChannel = (channel: PublicationChannel) =>
      pubs.find((p) => p.status === 'active' && p.channel === channel);

    return {
      ...toAppRow(row),
      publications: pubs,
      channels: {
        hosted_web: activeByChannel('hosted_web')
          ? {
              publicationId: activeByChannel('hosted_web')!.id,
              path: org ? `/${org.slug}/${row.slug}` : null,
              url: org
                ? `${this.env.AGENT_RUNTIME_ORIGIN}/${org.slug}/${row.slug}`
                : null,
            }
          : null,
        embed: activeByChannel('embed')
          ? {
              publicationId: activeByChannel('embed')!.id,
              path: org ? `/embed/${org.slug}/${row.slug}` : null,
              url: org
                ? `${this.env.EMBED_RUNTIME_ORIGIN}/embed/${org.slug}/${row.slug}`
                : null,
            }
          : null,
        api: activeByChannel('api')
          ? {
              publicationId: activeByChannel('api')!.id,
              docsPath: '/api/v1',
              sessionPath: '/api/v1/sessions',
            }
          : null,
        desktop: activeByChannel('desktop')
          ? {
              publicationId: activeByChannel('desktop')!.id,
              notes: 'Use desktop shell with org/app slug or publication token',
            }
          : null,
      },
      hostedPath:
        pubs.find((p) => p.status === 'active' && p.channel === 'hosted_web') && org
          ? `/${org.slug}/${row.slug}`
          : null,
    };
  }

  async create(
    ctx: RequestContext,
    input: {
      agentId: string;
      name: string;
      slug: string;
      description?: string;
      templateKey?: string;
    },
  ) {
    const agent = await this.agents.get(ctx.organizationId, input.agentId);
    if (!agent.currentApprovedVersionId) {
      throw new BadRequestException('Agent must have an approved version before creating an app');
    }

    const template = getApplicationTemplate(input.templateKey ?? 'general_assistant');
    if (!template) throw new BadRequestException('Unknown application template');

    const studioConfig = parseStudioConfig(template.config);
    const appId = newId('app');
    const now = new Date();

    await this.db.insert(applicationDefinitions).values({
      id: appId,
      organizationId: ctx.organizationId,
      agentId: agent.id,
      name: input.name,
      slug: input.slug,
      description: input.description ?? template.description,
      logoUrl: studioConfig.logoUrl ?? null,
      templateKey: template.key,
      status: 'draft',
      themeJson: JSON.stringify(studioConfig.theme),
      welcomeMessage: studioConfig.welcomeMessage,
      starterPromptsJson: JSON.stringify(studioConfig.starterPrompts),
      studioConfigJson: JSON.stringify(studioConfig),
      createdAt: now,
      updatedAt: now,
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'application.created',
      resourceType: 'application',
      resourceId: appId,
      metadata: { templateKey: template.key, slug: input.slug },
    });

    return this.get(ctx.organizationId, appId);
  }

  async update(
    ctx: RequestContext,
    applicationId: string,
    patch: {
      name?: string;
      description?: string;
      studioConfig?: Partial<ApplicationStudioConfig>;
    },
  ) {
    const current = await this.get(ctx.organizationId, applicationId);
    const nextConfig = parseStudioConfig({
      ...current.studioConfig,
      ...patch.studioConfig,
      theme: {
        ...current.studioConfig.theme,
        ...patch.studioConfig?.theme,
      },
      featureFlags: {
        ...current.studioConfig.featureFlags,
        ...patch.studioConfig?.featureFlags,
      },
    });

    await this.db
      .update(applicationDefinitions)
      .set({
        name: patch.name ?? current.name,
        description: patch.description ?? current.description,
        logoUrl: nextConfig.logoUrl ?? null,
        templateKey: nextConfig.templateKey,
        themeJson: JSON.stringify(nextConfig.theme),
        welcomeMessage: nextConfig.welcomeMessage,
        starterPromptsJson: JSON.stringify(nextConfig.starterPrompts),
        studioConfigJson: JSON.stringify(nextConfig),
        updatedAt: new Date(),
      })
      .where(eq(applicationDefinitions.id, applicationId));

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'application.updated',
      resourceType: 'application',
      resourceId: applicationId,
    });

    return this.get(ctx.organizationId, applicationId);
  }

  async publish(
    ctx: RequestContext,
    applicationId: string,
    channelInput: string = 'hosted_web',
  ) {
    if (!isPublicationChannel(channelInput)) {
      throw new BadRequestException(`Invalid publication channel: ${channelInput}`);
    }
    const channel = channelInput;
    const app = await this.get(ctx.organizationId, applicationId);
    const agent = await this.agents.get(ctx.organizationId, app.agentId);
    if (!agent.currentApprovedVersionId) {
      throw new BadRequestException('Agent has no approved version to publish');
    }
    const version = await this.agents.getVersion(
      ctx.organizationId,
      agent.currentApprovedVersionId,
    );

    const [deployment] = await this.db
      .select()
      .from(agentDeployments)
      .where(
        and(
          eq(agentDeployments.organizationId, ctx.organizationId),
          eq(agentDeployments.versionId, version.id),
          eq(agentDeployments.status, 'ready'),
        ),
      )
      .orderBy(desc(agentDeployments.createdAt))
      .limit(1);

    if (!deployment) {
      throw new BadRequestException(
        'No ready deployment for approved version. Wait for provisioning to complete.',
      );
    }

    const now = new Date();
    await this.db
      .update(publications)
      .set({ status: 'superseded', updatedAt: now })
      .where(
        and(
          eq(publications.applicationId, applicationId),
          eq(publications.status, 'active'),
          eq(publications.channel, channel),
        ),
      );

    const publicationId = newId('pub');
    await this.db.insert(publications).values({
      id: publicationId,
      organizationId: ctx.organizationId,
      applicationId,
      agentId: agent.id,
      versionId: version.id,
      deploymentId: deployment.id,
      channel,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await this.db
      .update(applicationDefinitions)
      .set({ status: 'published', updatedAt: now })
      .where(eq(applicationDefinitions.id, applicationId));

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'application.published',
      resourceType: 'publication',
      resourceId: publicationId,
      metadata: { applicationId, slug: app.slug, channel },
    });

    return this.get(ctx.organizationId, applicationId);
  }

  async unpublish(
    ctx: RequestContext,
    applicationId: string,
    channelInput: string = 'hosted_web',
  ) {
    if (!isPublicationChannel(channelInput)) {
      throw new BadRequestException(`Invalid publication channel: ${channelInput}`);
    }
    const channel = channelInput;
    const app = await this.get(ctx.organizationId, applicationId);
    const now = new Date();
    await this.db
      .update(publications)
      .set({ status: 'superseded', updatedAt: now })
      .where(
        and(
          eq(publications.applicationId, applicationId),
          eq(publications.status, 'active'),
          eq(publications.channel, channel),
        ),
      );

    const remainingActive = await this.db
      .select()
      .from(publications)
      .where(
        and(eq(publications.applicationId, applicationId), eq(publications.status, 'active')),
      );
    if (remainingActive.length === 0) {
      await this.db
        .update(applicationDefinitions)
        .set({ status: 'draft', updatedAt: now })
        .where(eq(applicationDefinitions.id, applicationId));
    }

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'application.unpublished',
      resourceType: 'application',
      resourceId: applicationId,
      metadata: { slug: app.slug, channel },
    });

    return this.get(ctx.organizationId, applicationId);
  }

  /** Reactivate a prior publication (rollback). */
  async rollback(ctx: RequestContext, applicationId: string, publicationId: string) {
    const app = await this.get(ctx.organizationId, applicationId);
    const target = app.publications.find((p) => p.id === publicationId);
    if (!target) {
      throw new NotFoundException('Publication not found');
    }
    if (!target.deploymentId) {
      throw new BadRequestException('Publication has no deployment');
    }

    const [deployment] = await this.db
      .select()
      .from(agentDeployments)
      .where(eq(agentDeployments.id, target.deploymentId))
      .limit(1);
    if (!deployment || deployment.status !== 'ready') {
      throw new BadRequestException('Target deployment is not ready');
    }

    const now = new Date();
    await this.db
      .update(publications)
      .set({ status: 'superseded', updatedAt: now })
      .where(
        and(
          eq(publications.applicationId, applicationId),
          eq(publications.status, 'active'),
          eq(publications.channel, target.channel),
        ),
      );

    const newPubId = newId('pub');
    await this.db.insert(publications).values({
      id: newPubId,
      organizationId: ctx.organizationId,
      applicationId,
      agentId: target.agentId,
      versionId: target.versionId,
      deploymentId: target.deploymentId,
      channel: target.channel,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await this.db
      .update(applicationDefinitions)
      .set({ status: 'published', updatedAt: now })
      .where(eq(applicationDefinitions.id, applicationId));

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'application.rolled_back',
      resourceType: 'publication',
      resourceId: newPubId,
      metadata: { applicationId, fromPublicationId: publicationId },
    });

    return this.get(ctx.organizationId, applicationId);
  }

  async createPublicationToken(
    ctx: RequestContext,
    publicationId: string,
    input: { name?: string; expiresInDays?: number },
  ) {
    const [publication] = await this.db
      .select()
      .from(publications)
      .where(
        and(
          eq(publications.id, publicationId),
          eq(publications.organizationId, ctx.organizationId),
          eq(publications.status, 'active'),
        ),
      )
      .limit(1);
    if (!publication) throw new NotFoundException('Active publication not found');

    const token = generatePublicationToken();
    const id = newId('ptok');
    const now = new Date();
    const expiresAt =
      input.expiresInDays && input.expiresInDays > 0
        ? new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    await this.db.insert(publicationTokens).values({
      id,
      organizationId: ctx.organizationId,
      publicationId,
      name: input.name ?? 'default',
      tokenHash: hashToken(token),
      createdByUserId: ctx.user.id,
      expiresAt,
      createdAt: now,
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'publication_token.created',
      resourceType: 'publication_token',
      resourceId: id,
      metadata: { publicationId, name: input.name ?? 'default' },
    });

    return {
      id,
      publicationId,
      name: input.name ?? 'default',
      token,
      expiresAt,
      createdAt: now,
    };
  }

  async listPublicationTokens(ctx: RequestContext, publicationId: string) {
    const rows = await this.db
      .select()
      .from(publicationTokens)
      .where(
        and(
          eq(publicationTokens.organizationId, ctx.organizationId),
          eq(publicationTokens.publicationId, publicationId),
        ),
      )
      .orderBy(desc(publicationTokens.createdAt));

    return rows.map((r) => ({
      id: r.id,
      publicationId: r.publicationId,
      name: r.name,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
    }));
  }

  async revokePublicationToken(ctx: RequestContext, tokenId: string) {
    const [row] = await this.db
      .select()
      .from(publicationTokens)
      .where(
        and(
          eq(publicationTokens.id, tokenId),
          eq(publicationTokens.organizationId, ctx.organizationId),
          isNull(publicationTokens.revokedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Publication token not found');

    const now = new Date();
    await this.db
      .update(publicationTokens)
      .set({ revokedAt: now })
      .where(eq(publicationTokens.id, tokenId));

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'publication_token.revoked',
      resourceType: 'publication_token',
      resourceId: tokenId,
      metadata: { publicationId: row.publicationId },
    });

    return { id: tokenId, revokedAt: now };
  }

  /** Backward-compatible one-shot create + publish used by earlier clients. */
  async createAndPublish(
    ctx: RequestContext,
    input: { agentId: string; name: string; slug: string; description?: string },
  ) {
    const created = await this.create(ctx, {
      ...input,
      templateKey: 'general_assistant',
    });
    const published = await this.publish(ctx, created.id, 'hosted_web');
    const hosted = published.channels.hosted_web;
    return {
      applicationId: published.id,
      publicationId: hosted?.publicationId,
      path: published.hostedPath,
    };
  }

  async getPublicApp(
    orgSlug: string,
    appSlug: string,
    channelInput: string = 'hosted_web',
  ) {
    if (!isPublicationChannel(channelInput)) {
      throw new BadRequestException(`Invalid publication channel: ${channelInput}`);
    }
    const channel = channelInput;
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);
    if (!org) throw new NotFoundException('Organization not found');

    const [app] = await this.db
      .select()
      .from(applicationDefinitions)
      .where(
        and(
          eq(applicationDefinitions.organizationId, org.id),
          eq(applicationDefinitions.slug, appSlug),
        ),
      )
      .limit(1);
    if (!app) throw new NotFoundException('Application not found');

    const [publication] = await this.db
      .select()
      .from(publications)
      .where(
        and(
          eq(publications.applicationId, app.id),
          eq(publications.status, 'active'),
          eq(publications.channel, channel),
        ),
      )
      .orderBy(desc(publications.createdAt))
      .limit(1);
    if (!publication) throw new NotFoundException('Publication not found');

    const studioConfig = publicStudioConfig(
      parseStudioConfig(JSON.parse(app.studioConfigJson || '{}')),
    );

    return {
      organization: { id: org.id, slug: org.slug, name: org.name },
      application: {
        id: app.id,
        name: app.name,
        slug: app.slug,
        description: app.description,
        logoUrl: app.logoUrl,
        welcomeMessage: studioConfig.welcomeMessage || app.welcomeMessage,
        theme: studioConfig.theme,
        starterPrompts: studioConfig.starterPrompts,
        studioConfig,
      },
      publication: {
        id: publication.id,
        agentId: publication.agentId,
        versionId: publication.versionId,
        channel: publication.channel,
      },
    };
  }
}
