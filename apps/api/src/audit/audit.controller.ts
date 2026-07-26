import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { AuditService } from '../core/audit.service.js';

@Controller('api/audit-events')
@UseGuards(AuthGuard, PermissionsGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  list(@AuthCtx() ctx: RequestContext, @Query() query: Record<string, string | undefined>) {
    const input = z
      .object({
        limit: z.coerce.number().int().positive().optional(),
        action: z.string().optional(),
        resourceType: z.string().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(query);

    return this.audit.list(ctx.organizationId, {
      limit: input.limit,
      action: input.action,
      resourceType: input.resourceType,
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
    });
  }
}
