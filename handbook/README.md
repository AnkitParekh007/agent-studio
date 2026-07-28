# Welcome to Agent Studio

**Agent Studio** is an enterprise Agent Application Factory: define an AI agent once, govern it centrally, and publish it as a secure web app, desktop shell, embedded copilot, or API — without handing end users the keys to your model stack.

Define once · Govern centrally · Publish anywhere · Provider-neutral core

Most "agent platforms" stop at a chat box. Agent Studio treats the agent as a **product**: versioned configuration, human approval gates, runtime provisioning, multi-channel publication, and a hardened Agent Gateway that sits between every surface and the model provider.

## Why this exists

Frontier models are powerful and still dangerously easy to ship wrongly:

- A prompt change goes live with no review trail.
- An embed leaks tokens in a query string.
- A “demo adapter” quietly runs in production.
- Spend, concurrency, and tool allowlists are afterthoughts.

Agent Studio is built so the **default path is the governed path**. Claude Managed Agents is the first execution provider. The domain stays provider-neutral through an `AgentRuntimeAdapter` boundary — so tomorrow’s runtime does not force you to rewrite tenancy, approvals, or publications.

## What you get

| Capability | What it means for an AI product |
| --- | --- |
| **Immutable versions** | An approved agent identity is a snapshot, not a mutable chat config. |
| **Separation of duties** | Builders submit; approvers decide. Self-approve is off by default. |
| **Agent Gateway** | Every session authenticates, authorizes, budgets, and audits through one door. |
| **Publish channels** | Hosted web, embed, API, and desktop — same approved version. |
| **Enterprise identity** | Email/password, optional OIDC SSO, TOTP MFA, privileged MFA gate. |
| **Ops package** | Production Compose, Caddy TLS, backups, retention purge, AuthZ smokes. |

> [!TIP]
> New here? Start with [Getting Started](overview/getting-started.md), then ship something real with [Ship your first governed agent](guides/first-agent.md).

## Who this handbook is for

- **Builders** shaping agent instructions, tools, and application branding
- **Approvers / platform owners** enforcing governance and spend
- **Operators** deploying the production Compose stack
- **Security engineers** reviewing identity, AuthZ, and threat boundaries
- **AI architects** evaluating how a factory model maps onto Managed Agents

## Reading this book

Use the sidebar like a factory floor map: **Overview → Guides → Product → Developing → Security → Operations**. Search lives in the header. Use the sun/moon control for light/dark theme.

> [!NOTE]
> Deep engineering notes also live in the repo under [`docs/`](https://github.com/AnkitParekh007/agent-studio/tree/main/docs). This handbook is the narrative, AI-centric surface; the repo docs remain the source of truth for ADRs and gap analysis.
