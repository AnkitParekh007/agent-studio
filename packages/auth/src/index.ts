import {
  accounts,
  sessions,
  twoFactors,
  users,
  verifications,
  type Database,
} from '@agent-studio/database';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth, twoFactor } from 'better-auth/plugins';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  /** Set by the twoFactor plugin once a user completes TOTP enrollment. */
  twoFactorEnabled?: boolean | null;
};

/**
 * The surface the API actually consumes. Declaring it explicitly keeps `tsc`
 * declaration emit portable — Better Auth's inferred plugin types reference the
 * plugins' own transitive zod copy, which cannot be named from this package.
 */
export type AuthInstance = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (input: {
      headers: Headers;
    }) => Promise<{ user: AuthenticatedUser } | null>;
  };
};

export type OidcProviderOptions = {
  providerId: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
};

export function createAuth(options: {
  db: Database;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  /** Enterprise SSO. Omit to keep email/password as the only credential path. */
  oidc?: OidcProviderOptions | null;
}): AuthInstance {
  return betterAuth({
    database: drizzleAdapter(options.db, {
      provider: 'pg',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        twoFactor: twoFactors,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      twoFactor(),
      ...(options.oidc
        ? [
            genericOAuth({
              config: [
                {
                  providerId: options.oidc.providerId,
                  discoveryUrl: options.oidc.discoveryUrl,
                  clientId: options.oidc.clientId,
                  clientSecret: options.oidc.clientSecret,
                  scopes: options.oidc.scopes,
                },
              ],
            }),
          ]
        : []),
    ],
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
  });
}
