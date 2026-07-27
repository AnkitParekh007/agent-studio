/**
 * Dumps the production Compose Postgres volume to ./backups/<timestamp>.sql.gz.
 * Cross-platform (no bash required).
 *
 * Usage: node scripts/backup-postgres.mjs [--out ./backups]
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, '.env.production');

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileEnv = readEnvFile(envFile);
const user = process.env.POSTGRES_USER ?? fileEnv.POSTGRES_USER ?? 'agentstudio';
const database = process.env.POSTGRES_DB ?? fileEnv.POSTGRES_DB ?? 'agentstudio';

const outFlagIndex = process.argv.indexOf('--out');
const outDir = path.resolve(
  root,
  outFlagIndex > -1 ? process.argv[outFlagIndex + 1] : 'backups',
);
mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(outDir, `agentstudio-${stamp}.sql.gz`);

const args = [
  'compose',
  '-f',
  'docker-compose.prod.yml',
  ...(existsSync(envFile) ? ['--env-file', '.env.production'] : []),
  'exec',
  '-T',
  'postgres',
  'pg_dump',
  '-U',
  user,
  '-d',
  database,
  '--clean',
  '--if-exists',
];

const child = spawn('docker', args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });

let stderrNote = '';
child.on('error', (err) => {
  stderrNote = err.message;
});

try {
  await pipeline(child.stdout, createGzip(), createWriteStream(outFile));
} catch (err) {
  console.error('Backup failed:', err.message || stderrNote);
  process.exit(1);
}

const code = await new Promise((resolve) => child.on('close', resolve));
if (code !== 0) {
  console.error(`pg_dump exited with code ${code}. ${stderrNote}`);
  process.exit(code ?? 1);
}

console.log(`Backup written to ${outFile}`);
