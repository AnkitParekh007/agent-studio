# Roadmap

Living status lives in [`docs/architecture/gap-analysis.md`](https://github.com/AnkitParekh007/agent-studio/tree/main/docs/architecture/gap-analysis.md) and [`docs/roadmap/implementation-phases.md`](https://github.com/AnkitParekh007/agent-studio/tree/main/docs/roadmap/implementation-phases.md).

## Landed (pilot-ready spine)

- Multi-channel publish + AuthZ hardening
- Production Compose + Caddy TLS + backups/retention
- OIDC + MFA + auth lockout
- Claude adapter + gateway budgets/concurrency
- Desktop release path (keys/certs still operator-supplied)

## Deferred / follow-ups

- SAML + SCIM directory sync
- Broader OTel auto-instrumentation
- Hosted/K8s charts beyond Compose
- Claude-native MCP transport (when available)
- Apple notarization when macOS shipping expands
