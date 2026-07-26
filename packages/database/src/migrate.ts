import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://agentstudio:agentstudio@localhost:5432/agentstudio';

async function main() {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(here, '..', 'drizzle');
  await migrate(db, { migrationsFolder });
  await client.end();
  console.log('Migrations applied');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
