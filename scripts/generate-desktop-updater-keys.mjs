/**
 * Generates a Tauri updater keypair into .secrets/ (gitignored).
 * Prints the public key, and with --write injects it into tauri.conf.json.
 *
 * Usage: node scripts/generate-desktop-updater-keys.mjs [--write]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const secretsDir = path.join(root, '.secrets');
const keyPath = path.join(secretsDir, 'desktop-updater.key');
const confPath = path.join(root, 'apps/desktop-shell/src-tauri/tauri.conf.json');
const writeConf = process.argv.includes('--write');

mkdirSync(secretsDir, { recursive: true });

if (existsSync(keyPath)) {
  console.log('Key already exists at', keyPath);
} else {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@agent-studio/desktop-shell',
      'exec',
      'tauri',
      'signer',
      'generate',
      '-w',
      keyPath,
      '--ci',
    ],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  if (result.status !== 0) {
    console.error('Failed to generate keys. Ensure @tauri-apps/cli is installed.');
    process.exit(result.status ?? 1);
  }
}

const pubPath = `${keyPath}.pub`;
if (existsSync(pubPath)) {
  const pubkey = readFileSync(pubPath, 'utf8').trim();
  console.log('\nPublic key (set plugins.updater.pubkey in tauri.conf.json):\n');
  console.log(pubkey);
  console.log('\nPrivate key path (CI secret TAURI_SIGNING_PRIVATE_KEY):\n', keyPath);

  if (writeConf) {
    const conf = JSON.parse(readFileSync(confPath, 'utf8'));
    conf.plugins ??= {};
    conf.plugins.updater ??= {};
    conf.plugins.updater.pubkey = pubkey;
    writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);
    console.log('\nWrote pubkey into', confPath);
  }
} else {
  console.log('Expected public key at', pubPath);
}
