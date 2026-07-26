const MEMORY_KEY = 'agent-studio.desktop.sessionCookie';

async function isTauri(): Promise<boolean> {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadSessionCookie(): Promise<string | null> {
  if (await isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('load_session_cookie');
  }
  return sessionStorage.getItem(MEMORY_KEY);
}

export async function saveSessionCookie(cookie: string): Promise<void> {
  if (await isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_session_cookie', { cookie });
    return;
  }
  sessionStorage.setItem(MEMORY_KEY, cookie);
}

export async function clearSessionCookie(): Promise<void> {
  if (await isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('clear_session_cookie');
    return;
  }
  sessionStorage.removeItem(MEMORY_KEY);
}

export function extractSessionCookie(setCookieHeaders: string[]): string | null {
  const pairs = setCookieHeaders
    .map((header) => header.split(';')[0]?.trim())
    .filter((value): value is string => Boolean(value && value.includes('=')));
  const session = pairs.find((value) => value.toLowerCase().includes('session'));
  return session ?? pairs[0] ?? null;
}
