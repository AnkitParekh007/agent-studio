import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { SecretsService } from './secrets.service.js';

@Controller('api/secrets')
@UseGuards(AuthGuard, PermissionsGuard)
export class SecretsController {
  constructor(@Inject(SecretsService) private readonly secrets: SecretsService) {}

  @Get()
  @RequirePermissions('governance:manage')
  list(@AuthCtx() ctx: RequestContext) {
    return this.secrets.list(ctx.organizationId);
  }

  @Post()
  @RequirePermissions('governance:manage')
  create(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        name: z.string().min(1),
        purpose: z.string().min(1),
        value: z.string().min(1),
      })
      .parse(body);
    return this.secrets.create(ctx, input);
  }

  @Post(':secretId/rotate')
  @RequirePermissions('governance:manage')
  rotate(
    @AuthCtx() ctx: RequestContext,
    @Param('secretId') secretId: string,
    @Body() body: unknown,
  ) {
    const input = z.object({ value: z.string().min(1) }).parse(body);
    return this.secrets.rotate(ctx, secretId, input.value);
  }
}
