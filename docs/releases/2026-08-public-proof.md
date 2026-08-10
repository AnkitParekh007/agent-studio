# Agent Studio — 2026.08 Public Proof Edition

This release packages `agent-studio` as the **Govern** layer of the public AI frontend and agent-systems ecosystem.

## Positioning

**A provider-neutral agent application factory and control plane that makes immutable versions, review/approval, provisioning, publication, revocation, and runtime access explicit governance concerns.**

## What is new in this edition

- static public HonKit handbook deployed through GitHub Pages;
- immutable approved-version and superseding lifecycle rules;
- provisioning state with stable idempotency keys and numbered retry attempts;
- stale-callback rejection, HMAC callback verification, freshness checks, and replay protection;
- publication/runtime access checks for revoked, stale, superseded, inactive, and terminated conditions;
- a provider-neutral `AgentRuntimeAdapter` boundary;
- recruiter-ready lifecycle architecture proof embedded in the README;
- reproducible hosted-handbook and local governance capture modes;
- clearer separation between public documentation, local deterministic runtime, and production-shaped infrastructure.

## Public proof

- Live handbook: https://ankitparekh007.github.io/agent-studio/
- Public proof: `docs/public-proof.md`
- Governance visual: `docs/assets/public-proof/governed-lifecycle-proof.png`
- Runnable local stack: documented in the root README

## Suggested GitHub Release title

`2026.08 Public Proof Edition — Governed Agent Lifecycle & Control Plane`

## Suggested release summary

Agent Studio's 2026.08 edition makes agent governance reviewable as architecture rather than hidden implementation detail. It adds immutable approved-version enforcement, superseding, provisioning retries, signed/replay-resistant callbacks, publication/revocation checks, a provider-neutral runtime boundary, a public architecture handbook, and recruiter-ready lifecycle proof.

The hosted surface is intentionally documentation-only; the full control plane/runtime remains local or deployment-shaped proof rather than a claimed public production SaaS.

## Best launch links

| Audience | Link |
| --- | --- |
| Architect / recruiter | live handbook + `docs/public-proof.md` |
| Platform engineer | lifecycle/domain packages |
| Security reviewer | signed callback and publication-access proof |
| Agent builder | local quickstart + runtime adapter boundary |

## Verification before publishing a GitHub Release

Require Handbook CI plus the repository's full lint, typecheck, test, build, migration, runtime-smoke, authorization-negative, production-compose, and TLS checks to remain green.

## Release boundary

This release describes real portable governance policy and production-shaped infrastructure, but it does not claim public production adoption or a hosted Agent Studio SaaS.

## Release date

2026-08-10
