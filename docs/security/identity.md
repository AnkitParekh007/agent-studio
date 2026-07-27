# Identity

Agent Studio uses [Better Auth](https://better-auth.com) behind `@agent-studio/auth`. The API
mounts it at `/api/auth/*` and never derives the auth origin from a client `Host` header —
request URLs are rebuilt from `BETTER_AUTH_URL`.

## Credential paths

| Path | Status | Notes |
| --- | --- | --- |
| Email + password | Always on | Seeded demo users use it; production orgs should prefer SSO |
| OIDC / OAuth2 (`genericOAuth`) | Opt-in | Enabled when `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` are all set |
| TOTP + backup codes (`twoFactor`) | Always available | Enrollment is user-driven; enforcement is opt-in |
| Publication tokens | Always on | Runtime-only, `end_user` role, never a login credential |

`loadEnv` refuses to boot if the three `OIDC_*` values are set only partially, so a half-configured
identity provider fails loudly instead of silently falling back to passwords.

### OIDC

```bash
OIDC_ISSUER_URL=https://idp.example.com    # discovery URL is derived from this
OIDC_CLIENT_ID=agent-studio
OIDC_CLIENT_SECRET=...
OIDC_PROVIDER_ID=oidc                      # appears in the callback path
OIDC_SCOPES=openid,profile,email
```

The redirect URI to register with the IdP is
`{BETTER_AUTH_URL}/api/auth/oauth2/callback/{OIDC_PROVIDER_ID}`.

SCIM / directory sync and SAML remain out of scope; membership is still granted through
`POST /api/orgs/current/invites`.

## MFA

The `twoFactor` plugin is always registered, so every user can enroll:

| Step | Endpoint |
| --- | --- |
| Start enrollment (returns TOTP URI + backup codes) | `POST /api/auth/two-factor/enable` |
| Confirm the first code | `POST /api/auth/two-factor/verify-totp` |
| Sign-in second factor | `POST /api/auth/two-factor/verify-totp` or `.../verify-backup-code` |
| Disable | `POST /api/auth/two-factor/disable` |

Enrollment state lives in `users.two_factor_enabled` and the `two_factors` table
(migration `0005_identity_hardening`). Secrets and backup codes are stored encrypted by
Better Auth; neither is ever returned to a client after enrollment.

### Soft gate for privileged roles

`REQUIRE_MFA_FOR_PRIVILEGED=true` makes `AuthGuard` reject session-authenticated requests from
`platform_admin`, `org_owner`, `org_admin` and `agent_approver` when the user has not enrolled,
with `403` and an enrollment hint. It is a **soft gate**: it does not change the sign-in flow, and
publication-token requests (`end_user`) are unaffected.

> Enable it only after the privileged users in an org have enrolled — otherwise they lose API
> access and must be re-enabled by flipping the flag back off.

## Abuse controls on `/api/auth/*`

Both counters live in Redis, so they hold across API replicas.

| Control | Key | Env |
| --- | --- | --- |
| Per-IP fixed-window rate limit | `auth:ratelimit:<ip>:<minute>` | `AUTH_RATE_LIMIT_PER_MINUTE` (20) |
| Failed sign-in counter | `auth:failures:<ip>:<email>` | `AUTH_LOCKOUT_MAX_FAILURES` (10), `AUTH_LOCKOUT_WINDOW_MS` (15m) |
| Lockout | `auth:lockout:<ip>:<email>` | `AUTH_LOCKOUT_DURATION_MS` (15m) |

Rate limiting applies to every `/api/auth/*` request. Lockout applies to sign-in and two-factor
verification only, is keyed by IP **and** attempted email so one attacker cannot lock a victim out
globally, and resets on the first success. Both return `429`.

Client IP comes from Fastify's `trustProxy`, configured with `TRUST_PROXY_HOPS`. Setting more hops
than you actually run behind lets a client forge `X-Forwarded-For` and defeat both controls; setting
`0` disables proxy parsing entirely.

Counters are exported as `agent_studio_auth_rate_limited`, `agent_studio_auth_lockout_blocked` and
`agent_studio_auth_lockouts_applied` on the bearer-protected `/metrics` endpoint.

## Session authorization

`AuthGuard` runs before every protected route and resolves one of two modes:

- `session` — Better Auth session plus a `memberships` row for the `x-organization-id` header.
  No membership means `401`, which is what keeps orgs isolated.
- `publication_token` — a hashed `pub_*` token scoped to one publication, resolved to the
  `end_user` role. `end_user` holds only `session:start`, so privileged surfaces such as
  `POST /api/integrations/mcp/call` are unreachable, and `GatewayService` additionally rejects a
  token used against a different publication.

Both behaviours are covered by `apps/api/src/auth/auth.guard.test.ts`,
`apps/api/src/gateway/gateway.service.test.ts` and `pnpm smoke:authz`.
