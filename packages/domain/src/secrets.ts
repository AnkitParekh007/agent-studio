const SECRET_PATTERNS = [
  /sk-ant-[a-zA-Z0-9_-]+/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /api[_-]?key["']?\s*[:=]\s*["']?[a-zA-Z0-9_-]{16,}/gi,
];

export function redactSecrets(input: string): string {
  let result = input;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

export function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        if (/secret|password|token|apiKey|api_key|credential/i.test(k)) {
          return [k, '[REDACTED]'];
        }
        return [k, redactUnknown(v)];
      }),
    );
  }
  return value;
}
