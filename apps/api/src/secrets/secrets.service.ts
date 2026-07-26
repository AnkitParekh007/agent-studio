import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { newId, secretReferences, secretValues } from '@agent-studio/database';
import { decryptSecret, encryptSecret } from '@agent-studio/domain';
import { and, desc, eq } from 'drizzle-orm';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, ENV, type Db, type Env } from '../core/tokens.js';

@Injectable()
export class SecretsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(organizationId: string) {
    const refs = await this.db
      .select()
      .from(secretReferences)
      .where(eq(secretReferences.organizationId, organizationId))
      .orderBy(desc(secretReferences.createdAt));
    return refs.map((r) => ({
      id: r.id,
      name: r.name,
      purpose: r.purpose,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async create(
    ctx: RequestContext,
    input: { name: string; purpose: string; value: string },
  ) {
    if (!input.value.trim()) throw new BadRequestException('Secret value is required');
    const id = newId('sec');
    const now = new Date();
    const enc = encryptSecret(this.env.SECRETS_MASTER_KEY, input.value);

    await this.db.insert(secretReferences).values({
      id,
      organizationId: ctx.organizationId,
      name: input.name,
      purpose: input.purpose,
      createdAt: now,
      updatedAt: now,
    });
    await this.db.insert(secretValues).values({
      secretReferenceId: id,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      createdAt: now,
      updatedAt: now,
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'secret.created',
      resourceType: 'secret_reference',
      resourceId: id,
      metadata: { name: input.name, purpose: input.purpose },
    });

    return { id, name: input.name, purpose: input.purpose, createdAt: now, updatedAt: now };
  }

  async rotate(ctx: RequestContext, secretId: string, value: string) {
    if (!value.trim()) throw new BadRequestException('Secret value is required');
    const ref = await this.getRef(ctx.organizationId, secretId);
    const now = new Date();
    const enc = encryptSecret(this.env.SECRETS_MASTER_KEY, value);

    await this.db
      .update(secretValues)
      .set({
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        updatedAt: now,
      })
      .where(eq(secretValues.secretReferenceId, secretId));

    await this.db
      .update(secretReferences)
      .set({ updatedAt: now })
      .where(eq(secretReferences.id, secretId));

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'secret.rotated',
      resourceType: 'secret_reference',
      resourceId: secretId,
      metadata: { name: ref.name },
    });

    return { id: secretId, name: ref.name, purpose: ref.purpose, updatedAt: now };
  }

  /** Server-side only — never expose plaintext over HTTP responses to clients. */
  async resolve(organizationId: string, secretId: string): Promise<string> {
    const ref = await this.getRef(organizationId, secretId);
    const [value] = await this.db
      .select()
      .from(secretValues)
      .where(eq(secretValues.secretReferenceId, ref.id))
      .limit(1);
    if (!value) throw new NotFoundException('Secret value not found');
    return decryptSecret(this.env.SECRETS_MASTER_KEY, {
      ciphertext: value.ciphertext,
      iv: value.iv,
      authTag: value.authTag,
    });
  }

  private async getRef(organizationId: string, secretId: string) {
    const [ref] = await this.db
      .select()
      .from(secretReferences)
      .where(
        and(
          eq(secretReferences.id, secretId),
          eq(secretReferences.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!ref) throw new NotFoundException('Secret not found');
    return ref;
  }
}
