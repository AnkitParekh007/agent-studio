import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
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

  @Post('api/applications/publish')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('application:publish')
  publish(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
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
