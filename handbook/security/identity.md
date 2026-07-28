# Identity & access

Better Auth powers `/api/auth/*`. Request URLs are rebuilt from `BETTER_AUTH_URL`, never from client `Host`.

## Credential paths

| Path | Status |
| --- | --- |
| Email + password | Always on |
| OIDC (`genericOAuth`) | Opt-in when all `OIDC_*` set |
| TOTP MFA | Always available; enforce with `REQUIRE_MFA_FOR_PRIVILEGED` |
| Publication tokens | Runtime `end_user` only |

## Privileged MFA gate

When enabled, `org_owner` / `org_admin` / `agent_approver` / `platform_admin` need verified MFA for privileged API calls.

Guide: [Turn on SSO and MFA](../guides/identity.md). Detail: `docs/security/identity.md`.
