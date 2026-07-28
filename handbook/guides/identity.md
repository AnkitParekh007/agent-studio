# Turn on SSO and MFA

Enterprise identity for an AI control plane: humans authenticate strongly; agents still run through publication tokens and the gateway.

## OIDC (SSO)

Set all three — partial config refuses to boot:

```bash
OIDC_ISSUER_URL=https://idp.example.com
OIDC_CLIENT_ID=agent-studio
OIDC_CLIENT_SECRET=...
OIDC_PROVIDER_ID=oidc
OIDC_SCOPES=openid,profile,email
```

Register this redirect URI at the IdP:

```text
{BETTER_AUTH_URL}/api/auth/oauth2/callback/{OIDC_PROVIDER_ID}
```

> [!NOTE]
> SAML and SCIM are deferred. Membership still flows through org invites.

## MFA (TOTP)

Better Auth `twoFactor` is always registered. Users enroll TOTP (and backup codes) from the auth UI/API.

### Enforce for privileged roles

Only after enrollment:

```bash
REQUIRE_MFA_FOR_PRIVILEGED=true
```

Applies to `org_owner`, `org_admin`, `agent_approver`, and `platform_admin`. Privileged API calls without a verified second factor return **403**.

> [!WARNING]
> Flipping the flag before enrollment locks builders and approvers out of the API. Order: enroll → enable → recreate `api`.

## Abuse controls

`/api/auth/*` is rate-limited and lockout-protected via Redis (shared across replicas). Client IP resolution is bounded by `TRUST_PROXY_HOPS` (use `1` behind the bundled Caddy).

Details: [Identity & access](../security/identity.md).
