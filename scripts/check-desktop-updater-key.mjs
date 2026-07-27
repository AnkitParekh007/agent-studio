/**
 * Fails when apps/desktop-shell/src-tauri/tauri.conf.json still carries the
 * development placeholder updater public key. Run before shipping desktop builds.
 *
 * Usage: node scripts/check-desktop-updater-key.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const confPath = path.join(root, 'apps/desktop-shell/src-tauri/tauri.conf.json');

const conf = JSON.parse(readFileSync(confPath, 'utf8'));
const pubkey = conf?.plugins?.updater?.pubkey ?? '';

if (!pubkey) {
  console.error('tauri.conf.json plugins.updater.pubkey is empty.');
  process.exit(1);
}

let decoded = '';
try {
  decoded = Buffer.from(pubkey, 'base64').toString('utf8');
} catch {
  decoded = '';
}

const haystack = `${pubkey}\n${decoded}`.toUpperCase();
const placeholders = ['DEV=ONLY', 'REPLACE-WITH-REAL-KEY', 'PLACEHOLDER', 'CHANGE_ME'];
const hit = placeholders.find((needle) => haystack.includes(needle));

if (hit) {
  console.error(
    `tauri.conf.json still uses a placeholder updater key (matched "${hit}").\n` +
      'Run `pnpm desktop:gen-updater-keys` and paste the printed public key into ' +
      'plugins.updater.pubkey, then set TAURI_SIGNING_PRIVATE_KEY in CI.',
  );
  process.exit(1);
}

console.log('Desktop updater public key looks real.');
