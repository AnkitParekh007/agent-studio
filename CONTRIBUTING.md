# Contributing to Agent Studio

Agent Studio is a governed agent application platform. Contributions should preserve lifecycle correctness, provider-neutral domain boundaries, authorization and honest production/development behavior.

## Before you start

1. Read `ARCHITECTURE_REVIEW.md` and `ARCHITECTURE_DECISIONS.md`.
2. Check existing issues before starting a large change.
3. Keep one architectural concern per pull request where practical.

## Local checks

Use the repository scripts appropriate to your change:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For lifecycle/runtime work, run the relevant smoke commands documented in the README.

## Pull request expectations

Describe:

- the problem being solved
- architecture decision or existing ADR affected
- security/authorization impact
- lifecycle/migration impact
- validation performed
- screenshots for visible UI changes

## Architecture guardrails

- do not couple core domain entities to one runtime provider without an explicit decision
- do not silently fall back to local runtime in production
- do not put provider/master secrets in client surfaces
- protected lifecycle transitions must be server-authorized
- async provisioning work must consider retries and duplicate execution
- public docs must distinguish implemented, development-only and planned behavior

## Good contributions

Focused tests, lifecycle edge cases, observability, accessibility, docs, runtime adapter correctness and recovery workflows are especially valuable.
