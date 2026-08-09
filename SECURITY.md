# Security Policy

Agent Studio includes authentication, authorization, secrets, agent lifecycle state, runtime providers and multiple application surfaces. Treat security boundaries as part of the architecture.

## Do not report secrets publicly

If you discover an exposed credential, token, private key or other sensitive value, revoke/rotate it first and avoid posting the value in a public issue.

## Core security boundaries

- client applications receive only public/runtime-safe configuration
- provider keys and secret-encryption material remain server-side
- authorization is enforced by API/server code, not only hidden UI controls
- agent versions and publication state must be checked at protected operations
- local deterministic runtime must not silently activate in production
- production seed/demo credentials must never be reused
- external callbacks/jobs should be authenticated and replay/duplicate aware where applicable

## Security review for pull requests

Changes affecting auth, secrets, approvals, runtime provisioning, publication, desktop sessions or external callbacks should document:

1. assets/trust boundary affected
2. authorization behavior
3. failure mode
4. secret/data exposure risk
5. tests used to validate the boundary

## Supported status

This repository is an evolving open-source platform. Review `ARCHITECTURE_REVIEW.md`, current documentation and deployment guidance before treating it as production-ready for a specific environment.
