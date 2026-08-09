# Public Proof Review Path

`Agent Studio` is the governance/control-plane layer of the portfolio. It is designed to prove that an agent application platform needs more than a chat runtime: immutable versions, review and approval, provisioning state, publication grants, revocation, replay-resistant callbacks, and provider-neutral runtime boundaries all matter.

There is intentionally no claim of a public production SaaS deployment. Public proof comes from the runnable local stack, deterministic local runtime, lifecycle policy, tests, and documented production boundaries.

## 30-second review

Read these ideas first:

1. **Define once, publish many ways** — web, desktop, embedded copilot, or API.
2. **Only the current approved immutable version is runnable.**
3. **Provisioning and publication are governed state machines, not fire-and-forget scripts.**
4. **Runtime providers sit behind `AgentRuntimeAdapter`, so governance is not tied to one model vendor.**

Then scan:

- [`README.md`](../README.md)
- [`docs/`](./) for product, security, deployment, testing, and roadmap material
- [`packages/domain/`](../packages/domain/) for version/provisioning/publication policy
- [`apps/api/`](../apps/api/) for signed callback enforcement at the API edge

## 3-minute review

Review these lifecycle guarantees:

| Governance rule | What it protects |
| --- | --- |
| immutable approved version | runtime cannot silently execute an edited/unreviewed definition |
| superseding | only one current approved version remains authoritative |
| provisioning idempotency | retries do not create uncontrolled duplicate publications |
| numbered retry attempts | stale asynchronous callbacks can be rejected |
| signed callback freshness | old or forged provisioning callbacks are rejected |
| callback replay protection | the same callback identifier cannot be accepted twice |
| publication grant checks | revoked, superseded, stale-version, and terminated-agent launches are blocked |
| provider-neutral runtime | governance survives runtime-provider changes |

## 15-minute runnable review

Start the local stack:

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm test
pnpm dev
```

Development surfaces:

- Control plane: `http://localhost:3000`
- Hosted agent apps: `http://localhost:3001`
- API + Agent Gateway: `http://localhost:4000`

Use the local deterministic runtime for public demos. It requires explicit opt-in and is blocked in production.

For a deeper quality pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:governance
```

## Public demo sequence

A short recruiter/architect walkthrough should focus on governance rather than generic chat:

1. create or inspect an agent definition;
2. create a new version;
3. show that the version waits for review/approval;
4. approve the current version and explain superseding;
5. start publication/provisioning;
6. explain stable idempotency keys and retry attempts;
7. show that revoked or stale publication access is denied;
8. finish at the runtime-provider adapter boundary.

If screenshots are captured, prioritize lifecycle states and review surfaces over decorative chat screens.

## Security proof points

- secrets and provider credentials remain server-side;
- local runtime cannot silently become a production fallback;
- signed provisioning callbacks use HMAC verification plus freshness checks;
- callback identifiers are replay-protected;
- stale attempts are rejected at the domain boundary;
- publication grants are checked against agent/version lifecycle state before use;
- separation-of-duties approval is represented in seeded development roles.

## What is demo vs production-shaped

| Surface | Status |
| --- | --- |
| local deterministic runtime | development/demo only |
| domain lifecycle rules | real portable application policy |
| API signed-callback verification | real server-edge implementation |
| database migrations/schema | real local/production-shaped infrastructure |
| Docker Compose production package | production-shaped packaging, not a claim of hosted production adoption |
| Claude Managed Agents adapter | real provider adapter, requires valid credentials |

## Ecosystem path

This repository is the **governance/control-plane** layer:

[AI Tools Cheatsheets](https://github.com/AnkitParekh007/ai-tools-cheatsheets) → [Frontend AI Patterns](https://github.com/AnkitParekh007/frontend-ai-patterns) → [Angular AI Copilot Starter](https://github.com/AnkitParekh007/angular-ai-copilot-starter) → [ngx-copilot-platform](https://github.com/AnkitParekh007/ngx-copilot-platform) → **Agent Studio** → [Org AI Force](https://github.com/AnkitParekh007/org-ai-force)

**Learn → Pattern → Run → Platform → Govern → Operate**
