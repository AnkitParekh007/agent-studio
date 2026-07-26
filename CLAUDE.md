# CLAUDE.md — Agent Studio

## Product

Agent Studio is an enterprise Agent Application Factory. Core principle: define an agent once, govern it centrally, publish anywhere as a secure branded application.

## Non-negotiables

- Original branding/UX/code — do not copy Claude or Cursor proprietary UI.
- Never put Anthropic API keys or server secrets in browser/desktop clients.
- Domain services must not call the Anthropic SDK directly; use `AgentRuntimeAdapter`.
- Approved agent versions are immutable. Edits create new drafts.
- Production must never silently fall back to the local runtime adapter.
- Authorization is enforced server-side on every protected operation.
- No fake production integrations or mock success paths presented as real.

## Stack

pnpm + Turborepo, NestJS (Fastify), Next.js, PostgreSQL + Drizzle, Redis + BullMQ, Better Auth, Zod, Vitest, Claude Managed Agents beta (`managed-agents-2026-04-01`).

## Working style

Prefer coherent vertical slices over shallow feature sprawl. Prefer extending existing packages over inventing parallel abstractions. Update docs when architecture or env contracts change.
