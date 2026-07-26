export function logInfo(message: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: 'info', message, ts: new Date().toISOString(), ...fields }));
}

export function logWarn(message: string, fields: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ level: 'warn', message, ts: new Date().toISOString(), ...fields }));
}

export function logError(message: string, fields: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ level: 'error', message, ts: new Date().toISOString(), ...fields }));
}
