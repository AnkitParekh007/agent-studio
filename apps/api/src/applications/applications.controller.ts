import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { ApplicationsService } from './applications.service.js';

@Controller()
export class ApplicationsController {
  constructor(
    @Inject(ApplicationsService) private readonly applications: ApplicationsService,
  ) {}

  @Get('api/application-templates')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('application:publish')
  templates() {
    return this.applications.listTemplates();
  }

  @Get('api/applications')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('application:publish')
  list(@AuthCtx() ctx: RequestContext) {
    return this.applications.list(ctx.organizationId);
  }

  @Post('api/applications')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('application:publish')
  create(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        agentId: z.string().min(1),
        name: z.string().min(1),
        slug: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-]+$/),
        description: z.string().optional(),
        templateKey: z.string().optional(),
      })
      .parse(body);
    return this.applications.create(ctx, input);
  }

  @Get('api/applications/:applicationId')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('application:publish')
  get(@AuthCtx() ctx: RequestContext, @Param('applicationId') applicationId: string) {
    return this.applications.get(ctx.organizationId, applicationId);
  }

  @Patch('api/applications/:applicationId')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('application:publish')
  update(
    @AuthCtx() ctx: RequestContext,
    @Param('applicationId') applicationId: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        studioConfig: z.record(z.unknown()).optional(),
      })
      .parse(body);
    return this.applications.update(ctx, applicationId, input as never);
  }

  @Post('api/applications/:applicationId/publish')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('application:publish')
  publish(@AuthCtx() ctx: RequestContext, @Param('applicationId') applicationId: string) {
    return this.applications.publish(ctx, applicationId);
  }

  @Post('api/applications/publish')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('application:publish')
  publishLegacy(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        agentId: z.string().min(1),
        name: z.string().min(1),
        slug: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-]+$/),
        description: z.string().optional(),
      })
      .parse(body);
    return this.applications.createAndPublish(ctx, input);
  }

  @Get('api/public/apps/:orgSlug/:appSlug')
  publicApp(@Param('orgSlug') orgSlug: string, @Param('appSlug') appSlug: string) {
    return this.applications.getPublicApp(orgSlug, appSlug);
  }
}
