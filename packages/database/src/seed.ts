import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { createDb } from './client.js';
import { newId } from './ids.js';
import { accounts, users } from './schema/auth.js';
import { memberships, organizations, workspaces } from './schema/tenancy.js';

async function ensureUser(
  db: ReturnType<typeof createDb>,
  input: { email: string; name: string; password: string },
) {
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing[0]) return existing[0].id;

  const userId = newId('user');
  const now = new Date();
  const passwordHash = await hashPassword(input.password);
  await db.insert(users).values({
    id: userId,
    name: input.name,
    email: input.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(accounts).values({
    id: newId('acc'),
    accountId: userId,
    providerId: 'credential',
    userId,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });
  return userId;
}

async function ensureMembership(
  db: ReturnType<typeof createDb>,
  organizationId: string,
  userId: string,
  roleKey: string,
) {
  const [existing] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId)))
    .limit(1);
  if (existing) return existing.id;

  const membershipId = newId('mem');
  const now = new Date();
  await db.insert(memberships).values({
    id: membershipId,
    organizationId,
    userId,
    roleKey,
    createdAt: now,
    updatedAt: now,
  });
  return membershipId;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed when NODE_ENV=production');
  }

  const databaseUrl =
    process.env.DATABASE_URL ?? 'postgresql://agentstudio:agentstudio@localhost:5432/agentstudio';
  const db = createDb(databaseUrl);

  const ownerEmail = 'owner@example.com';
  const ownerPassword = 'Password123!';
  const approverEmail = 'approver@example.com';
  const approverPassword = 'Password123!';

  const ownerId = await ensureUser(db, {
    email: ownerEmail,
    name: 'Org Owner',
    password: ownerPassword,
  });
  const approverId = await ensureUser(db, {
    email: approverEmail,
    name: 'Agent Approver',
    password: approverPassword,
  });

  let orgId: string;
  const [existingOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, 'acme'))
    .limit(1);
  if (existingOrg) {
    orgId = existingOrg.id;
  } else {
    orgId = newId('org');
    const now = new Date();
    await db.insert(organizations).values({
      id: orgId,
      name: 'Acme Agents',
      slug: 'acme',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workspaces).values({
      id: newId('ws'),
      organizationId: orgId,
      name: 'Default',
      slug: 'default',
      createdAt: now,
      updatedAt: now,
    });
  }

  await ensureMembership(db, orgId, ownerId, 'org_owner');
  await ensureMembership(db, orgId, approverId, 'agent_approver');

  console.log('Seeded development data');
  console.log(`  owner: ${ownerEmail} / ${ownerPassword}`);
  console.log(`  approver: ${approverEmail} / ${approverPassword}`);
  console.log('  organization: acme');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
