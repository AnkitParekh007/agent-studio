/**
 * Restore drill for the production Compose Postgres volume.
 *
 * Creates a fresh backup, then restores into a throwaway DB (default) or the live
 * DB when --live is passed.
 *
 * Usage:
 *   node scripts/restore-drill.mjs           # safe: restore into agentstudio_restore_drill
 *   node scripts/restore-drill.mjs --live    # destructive: restore into the live DB
 */
import { spawn } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { createGunzip } from 'node:zlib';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.production');
const live = process.argv.includes('--live');

function loadEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileEnv = loadEnv(envFile);
const user = process.env.POSTGRES_USER ?? fileEnv.POSTGRES_USER ?? 'agentstudio';
const database = process.env.POSTGRES_DB ?? fileEnv.POSTGRES_DB ?? 'agentstudio';
const targetDb = live ? database : `${database}_restore_drill`;

function compose(args, opts = {}) {
  const full = [
    'compose',
    '-f',
    'docker-compose.prod.yml',
    ...(existsSync(envFile) ? ['--env-file', '.env.production'] : []),
    ...args,
  ];
  return spawn('docker', full, { cwd: root, stdio: opts.stdio ?? 'inherit' });
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = compose(args);
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`docker ${args.join(' ')} => ${code}`)),
    );
  });
}

function latestBackup() {
  const dir = path.join(root, 'backups');
  if (!existsSync(dir)) throw new Error('No backups/ directory — run pnpm backup:db first');
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('agentstudio-') && f.endsWith('.sql.gz'))
    .map((f) => ({ f, mtime: statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) throw new Error('No agentstudio-*.sql.gz backups found');
  return path.join(dir, files[0].f);
}

console.log(live ? 'LIVE restore drill (destructive)' : `Safe restore drill → database ${targetDb}`);

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'backup-postgres.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });
  child.on('error', reject);
  child.on('close', (code) =>
    code === 0 ? resolve() : reject(new Error(`backup failed: ${code}`)),
  );
});

const dump = latestBackup();
console.log(`Using dump ${dump}`);

if (live) {
  console.log('Stopping app writers…');
  await run([
    'stop',
    'api',
    'worker',
    'control-plane-web',
    'agent-web-runtime',
    'embed-runtime',
  ]);
} else {
  // DROP DATABASE cannot run inside a multi-statement transaction — use separate -c calls.
  for (const sql of [
    `DROP DATABASE IF EXISTS ${targetDb}`,
    `CREATE DATABASE ${targetDb} OWNER ${user}`,
  ]) {
    await new Promise((resolve, reject) => {
      const child = compose([
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        user,
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        sql,
      ]);
      child.on('error', reject);
      child.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`${sql} => ${code}`)),
      );
    });
  }
}

console.log(`Restoring into ${targetDb}…`);
await new Promise((resolve, reject) => {
  const child = compose(
    ['exec', '-T', 'postgres', 'psql', '-U', user, '-d', targetDb, '-v', 'ON_ERROR_STOP=1'],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  child.on('error', reject);
  pipeline(createReadStream(dump), createGunzip(), child.stdin).catch(reject);
  child.on('close', (code) =>
    code === 0 ? resolve() : reject(new Error(`psql restore => ${code}`)),
  );
});

await new Promise((resolve, reject) => {
  const child = compose([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    user,
    '-d',
    targetDb,
    '-c',
    "SELECT 'organizations' AS tbl, count(*)::text AS n FROM organizations UNION ALL SELECT 'users', count(*)::text FROM users UNION ALL SELECT 'agent_definitions', count(*)::text FROM agent_definitions;",
  ]);
  child.on('error', reject);
  child.on('close', (code) =>
    code === 0 ? resolve() : reject(new Error(`verify => ${code}`)),
  );
});

if (live) {
  console.log('Re-applying migrations and restarting…');
  await run(['run', '--rm', 'migrate']);
  await run(['up', '-d']);
  console.log('Live restore drill complete. Check /health and sign-in.');
} else {
  console.log(
    `Safe restore drill complete. Inspect with:\n  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres psql -U ${user} -d ${targetDb}`,
  );
  console.log(
    `Drop when done:\n  … psql -U ${user} -d postgres -c 'DROP DATABASE ${targetDb};'`,
  );
}
