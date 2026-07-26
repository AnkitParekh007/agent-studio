import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async createAndPublish(
    ctx: RequestContext,
    input: { agentId: string; name: string; slug: string; description?: string },
  ) {
    const agent = await this.agents.get(ctx.organizationId, input.agentId);
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

    const appId = newId('app');
    const publicationId = newId('pub');
    const now = new Date();
    const theme = version.config.applicationConfig.theme;

    await this.db.insert(applicationDefinitions).values({
      id: appId,
      organizationId: ctx.organizationId,
      agentId: agent.id,
      name: input.name,
      slug: input.slug,
      description: input.description ?? '',
      themeJson: JSON.stringify(theme),
      welcomeMessage: version.config.applicationConfig.welcomeMessage,
      starterPromptsJson: JSON.stringify(version.config.starterPrompts),
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(publications).values({
      id: publicationId,
      organizationId: ctx.organizationId,
      applicationId: appId,
      agentId: agent.id,
      versionId: version.id,
      deploymentId: deployment.id,
      channel: 'hosted_web',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'application.published',
      resourceType: 'publication',
      resourceId: publicationId,
      metadata: { applicationId: appId, slug: input.slug },
    });

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
      .limit(1);

    return {
      applicationId: appId,
      publicationId,
      path: `/${org?.slug ?? 'org'}/${input.slug}`,
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

    return {
      organization: { id: org.id, slug: org.slug, name: org.name },
      application: {
        id: app.id,
        name: app.name,
        slug: app.slug,
        description: app.description,
        welcomeMessage: app.welcomeMessage,
        theme: JSON.parse(app.themeJson) as Record<string, string>,
        starterPrompts: JSON.parse(app.starterPromptsJson) as string[],
      },
      publication: {
        id: publication.id,
        agentId: publication.agentId,
        versionId: publication.versionId,
      },
    };
  }
}
