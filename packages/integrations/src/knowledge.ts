export type KnowledgeFetchResult = {
  name: string;
  uri: string;
  content: string;
  truncated: boolean;
  error?: string;
};

const DEFAULT_MAX_BYTES = 48_000;
const DEFAULT_TIMEOUT_MS = 8_000;

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchKnowledgeSource(input: {
  name: string;
  uri: string;
  maxBytes?: number;
  timeoutMs?: number;
}): Promise<KnowledgeFetchResult> {
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (input.uri.startsWith('text:')) {
    const content = input.uri.slice('text:'.length);
    return {
      name: input.name,
      uri: input.uri,
      content: content.slice(0, maxBytes),
      truncated: content.length > maxBytes,
    };
  }

  if (!input.uri.startsWith('http://') && !input.uri.startsWith('https://')) {
    return {
      name: input.name,
      uri: input.uri,
      content: '',
      truncated: false,
      error: 'Only http(s) and text: URIs are supported',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input.uri, {
      signal: controller.signal,
      headers: { accept: 'text/plain,text/markdown,text/html,application/json,*/*' },
    });
    if (!res.ok) {
      return {
        name: input.name,
        uri: input.uri,
        content: '',
        truncated: false,
        error: `HTTP ${res.status}`,
      };
    }
    const raw = await res.text();
    const contentType = res.headers.get('content-type') ?? '';
    const normalized = contentType.includes('html') ? stripHtml(raw) : raw.trim();
    return {
      name: input.name,
      uri: input.uri,
      content: normalized.slice(0, maxBytes),
      truncated: normalized.length > maxBytes,
    };
  } catch (err) {
    return {
      name: input.name,
      uri: input.uri,
      content: '',
      truncated: false,
      error: err instanceof Error ? err.message : 'fetch failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchKnowledgeSources(
  sources: Array<{ name: string; uri: string }>,
): Promise<KnowledgeFetchResult[]> {
  return Promise.all(sources.map((s) => fetchKnowledgeSource(s)));
}
