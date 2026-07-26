import { randomUUID } from 'node:crypto';

export function newId(prefix?: string): string {
  const id = randomUUID().replace(/-/g, '');
  return prefix ? `${prefix}_${id}` : id;
}
