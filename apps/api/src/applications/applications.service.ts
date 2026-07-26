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
  publications,
} from '@agent-studio/database';
import { and, desc, eq } from 'drizzle-orm';
import { AgentsService } from '../agents/agents.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, type Db } from '../core/tokens.js';

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

    return {
      ...toAppRow(row),
      publications: pubs,
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

  async publish(ctx: RequestContext, applicationId: string) {
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
          eq(publications.channel, 'hosted_web'),
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
      channel: 'hosted_web',
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
      metadata: { applicationId, slug: app.slug },
    });

    return this.get(ctx.organizationId, applicationId);
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
    const published = await this.publish(ctx, created.id);
    return {
      applicationId: published.id,
      publicationId: published.publications[0]?.id,
      path: published.hostedPath,
    };
  }

  async getPublicApp(orgSlug: string, appSlug: string) {
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
          eq(publications.channel, 'hosted_web'),
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
      },
    };
  }
}
