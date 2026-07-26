import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  memberships,
  newId,
  organizationInvites,
  organizationSettings,
  users,
} from '@agent-studio/database';
import { ROLE_KEYS, type RoleKey, hashToken } from '@agent-studio/domain';
import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, type Db } from '../core/tokens.js';

function inviteToken(): string {
  return `inv_${randomBytes(24).toString('hex')}`;
}

@Injectable()
export class OrgsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listMembers(organizationId: string) {
    return this.db
      .select({
        membershipId: memberships.id,
        userId: users.id,
        email: users.email,
        name: users.name,
        roleKey: memberships.roleKey,
        createdAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.organizationId, organizationId));
  }

  async invite(
    ctx: RequestContext,
    input: { email: string; roleKey: RoleKey },
  ) {
    if (!ROLE_KEYS.includes(input.roleKey)) {
      throw new BadRequestException('Invalid role');
    }
    if (input.roleKey === 'platform_admin' || input.roleKey === 'org_owner') {
      throw new ForbiddenException('Cannot invite as platform_admin or org_owner');
    }

    const email = input.email.trim().toLowerCase();
    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      const [existingMem] = await this.db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, ctx.organizationId),
            eq(memberships.userId, existingUser.id),
          ),
        )
        .limit(1);
      if (existingMem) throw new BadRequestException('User is already a member');

      const membershipId = newId('mem');
      const now = new Date();
      await this.db.insert(memberships).values({
        id: membershipId,
        organizationId: ctx.organizationId,
        userId: existingUser.id,
        roleKey: input.roleKey,
        createdAt: now,
        updatedAt: now,
      });

      await this.audit.record({
        organizationId: ctx.organizationId,
        actorUserId: ctx.user.id,
        action: 'org.member_added',
        resourceType: 'membership',
        resourceId: membershipId,
        metadata: { email, roleKey: input.roleKey },
      });

      return { status: 'added' as const, membershipId, email, roleKey: input.roleKey };
    }

    const token = inviteToken();
    const inviteId = newId('invite');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await this.db.insert(organizationInvites).values({
      id: inviteId,
      organizationId: ctx.organizationId,
      email,
      roleKey: input.roleKey,
      tokenHash: hashToken(token),
      invitedByUserId: ctx.user.id,
      expiresAt,
      createdAt: now,
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'org.invite_created',
      resourceType: 'organization_invite',
      resourceId: inviteId,
      metadata: { email, roleKey: input.roleKey },
    });

    return {
      status: 'invited' as const,
      inviteId,
      email,
      roleKey: input.roleKey,
      token,
      expiresAt,
    };
  }

  async acceptInvite(user: { id: string; email: string }, token: string) {
    const [invite] = await this.db
      .select()
      .from(organizationInvites)
      .where(
        and(eq(organizationInvites.tokenHash, hashToken(token)), isNull(organizationInvites.acceptedAt)),
      )
      .limit(1);
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invite expired');
    }
    if (user.email.trim().toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException('Invite email does not match signed-in user');
    }

    const [existingMem] = await this.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, invite.organizationId),
          eq(memberships.userId, user.id),
        ),
      )
      .limit(1);
    if (existingMem) throw new BadRequestException('Already a member');

    const now = new Date();
    const membershipId = newId('mem');
    await this.db.insert(memberships).values({
      id: membershipId,
      organizationId: invite.organizationId,
      userId: user.id,
      roleKey: invite.roleKey,
      createdAt: now,
      updatedAt: now,
    });
    await this.db
      .update(organizationInvites)
      .set({ acceptedAt: now })
      .where(eq(organizationInvites.id, invite.id));

    await this.audit.record({
      organizationId: invite.organizationId,
      actorUserId: user.id,
      action: 'org.invite_accepted',
      resourceType: 'membership',
      resourceId: membershipId,
      metadata: { inviteId: invite.id },
    });

    return { organizationId: invite.organizationId, membershipId, roleKey: invite.roleKey };
  }

  async updateMemberRole(ctx: RequestContext, userId: string, roleKey: RoleKey) {
    if (!ROLE_KEYS.includes(roleKey)) throw new BadRequestException('Invalid role');
    if (roleKey === 'platform_admin') {
      throw new ForbiddenException('Cannot assign platform_admin');
    }
    if (userId === ctx.user.id) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const [mem] = await this.db
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.organizationId, ctx.organizationId), eq(memberships.userId, userId)),
      )
      .limit(1);
    if (!mem) throw new NotFoundException('Member not found');
    if (mem.roleKey === 'org_owner') {
      throw new ForbiddenException('Cannot change org_owner role');
    }

    await this.db
      .update(memberships)
      .set({ roleKey, updatedAt: new Date() })
      .where(eq(memberships.id, mem.id));

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'org.member_role_updated',
      resourceType: 'membership',
      resourceId: mem.id,
      metadata: { userId, roleKey },
    });

    return { membershipId: mem.id, userId, roleKey };
  }

  async getSettings(organizationId: string) {
    const [row] = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);
    return {
      organizationId,
      maxUsdMonthly: row?.maxUsdMonthly ?? null,
      maxConcurrentSessions: row?.maxConcurrentSessions ?? null,
    };
  }

  async upsertSettings(
    ctx: RequestContext,
    input: { maxUsdMonthly?: string | null; maxConcurrentSessions?: number | null },
  ) {
    const now = new Date();
    const [existing] = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, ctx.organizationId))
      .limit(1);

    if (existing) {
      await this.db
        .update(organizationSettings)
        .set({
          maxUsdMonthly:
            input.maxUsdMonthly === undefined ? existing.maxUsdMonthly : input.maxUsdMonthly,
          maxConcurrentSessions:
            input.maxConcurrentSessions === undefined
              ? existing.maxConcurrentSessions
              : input.maxConcurrentSessions,
          updatedAt: now,
        })
        .where(eq(organizationSettings.organizationId, ctx.organizationId));
    } else {
      await this.db.insert(organizationSettings).values({
        organizationId: ctx.organizationId,
        maxUsdMonthly: input.maxUsdMonthly ?? null,
        maxConcurrentSessions: input.maxConcurrentSessions ?? null,
        updatedAt: now,
      });
    }

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'org.settings_updated',
      resourceType: 'organization_settings',
      resourceId: ctx.organizationId,
      metadata: input as Record<string, unknown>,
    });

    return this.getSettings(ctx.organizationId);
  }
}
