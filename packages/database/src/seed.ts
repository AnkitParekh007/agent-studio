import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { createDb } from './client.js';
import { newId } from './ids.js';
import { accounts, users } from './schema/auth.js';
import { memberships, organizations, workspaces } from './schema/tenancy.js';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed when NODE_ENV=production');
  }

  const databaseUrl =
    process.env.DATABASE_URL ?? 'postgresql://agentstudio:agentstudio@localhost:5432/agentstudio';
  const db = createDb(databaseUrl);

  const email = 'owner@example.com';
  const password = 'Password123!';
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    console.log('Seed already present:', email);
    process.exit(0);
  }

  const userId = newId('user');
  const orgId = newId('org');
  const workspaceId = newId('ws');
  const now = new Date();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id: userId,
    name: 'Org Owner',
    email,
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

  await db.insert(organizations).values({
    id: orgId,
    name: 'Acme Agents',
    slug: 'acme',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(workspaces).values({
    id: workspaceId,
    organizationId: orgId,
    name: 'Default',
    slug: 'default',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(memberships).values({
    id: newId('mem'),
    organizationId: orgId,
    userId,
    roleKey: 'org_owner',
    createdAt: now,
    updatedAt: now,
  });

  console.log('Seeded development data');
  console.log(`  email: ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  organization: acme`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
