import { accounts, sessions, users, verifications, type Database } from '@agent-studio/database';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export type AuthInstance = ReturnType<typeof createAuth>;

export function createAuth(options: {
  db: Database;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
}) {
  return betterAuth({
    database: drizzleAdapter(options.db, {
      provider: 'pg',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
  });
}
