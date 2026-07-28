/**
 * Schedules or runs the daily Postgres backup for the production Compose stack.
 *
 * Usage:
 *   node scripts/schedule-backup.mjs              # run once now
 *   node scripts/schedule-backup.mjs --install     # print OS-specific schedule instructions
 *   node scripts/schedule-backup.mjs --daemon 24h  # stay alive and run every 24h (dev/pilot only)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupScript = path.join(root, 'scripts', 'backup-postgres.mjs');
const defaultOut = path.join(root, 'backups');

function parseInterval(raw) {
  const match = String(raw ?? '24h').match(/^(\d+)(h|m|d)$/i);
  if (!match) throw new Error(`Invalid interval "${raw}" (use e.g. 24h, 60m, 1d)`);
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const ms = unit === 'd' ? n * 86400000 : unit === 'h' ? n * 3600000 : n * 60000;
  return ms;
}

/** Keep the newest `keep` dumps; delete older .sql.gz in the out dir. */
function prune(outDir, keep = 14) {
  if (!existsSync(outDir)) return;
  const files = readdirSync(outDir)
    .filter((f) => f.startsWith('agentstudio-') && f.endsWith('.sql.gz'))
    .map((f) => ({ f, mtime: statSync(path.join(outDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const old of files.slice(keep)) {
    unlinkSync(path.join(outDir, old.f));
    console.log(`Pruned old backup ${old.f}`);
  }
}

function runBackup() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [backupScript], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        prune(defaultOut, Number(process.env.BACKUP_KEEP ?? 14));
        resolve();
      } else {
        reject(new Error(`backup-postgres.mjs exited ${code}`));
      }
    });
  });
}

const args = process.argv.slice(2);

if (args.includes('--install')) {
  const node = process.execPath;
  const scriptPath = path.join(root, 'scripts', 'schedule-backup.mjs');
  const cmdFile = path.join(root, 'scripts', 'run-backup.cmd');
  // Windows Task Scheduler mangling of quoted paths with spaces is unreliable;
  // point /TR at a tiny .cmd wrapper instead.
  console.log(`# Daily backup schedule (run as the deploy user)\n`);
  console.log(`## Windows — write wrapper then register task (elevated PowerShell)`);
  console.log(
    `@'\n@echo off\n"${node}" "${scriptPath}"\n'@ | Set-Content -Encoding ascii "${cmdFile}"`,
  );
  console.log(
    `schtasks /Create /TN "AgentStudio-DB-Backup" /SC DAILY /ST 02:30 /RL LIMITED /TR "${cmdFile}" /F`,
  );
  console.log(`\n## Linux / macOS cron`);
  console.log(
    `30 2 * * * cd "${root}" && "${node}" "${scriptPath}" >> "${path.join(root, 'backups', 'backup.log')}" 2>&1`,
  );
  console.log(`\n## Verify`);
  console.log(`pnpm backup:db`);
  console.log(`# then follow docs/operations/backups.md restore drill`);
  process.exit(0);
}

mkdirSync(defaultOut, { recursive: true });

const daemonIdx = args.indexOf('--daemon');
if (daemonIdx === -1) {
  await runBackup();
  process.exit(0);
}

const intervalMs = parseInterval(args[daemonIdx + 1] ?? '24h');
console.log(`Backup daemon: every ${intervalMs}ms (first run immediately)`);
for (;;) {
  try {
    await runBackup();
  } catch (err) {
    console.error(err.message || err);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}
