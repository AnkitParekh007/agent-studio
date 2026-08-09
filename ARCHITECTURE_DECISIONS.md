# Architecture Decisions — Agent Studio

## ADR-001 — Provider-neutral runtime domain

**Context:** execution providers can change over time.

**Decision:** keep runtime behavior behind `AgentRuntimeAdapter` so provider packages translate into common runtime events.

**Tradeoff:** adapters add translation work, but core lifecycle rules stay independent of one provider.

## ADR-002 — Immutable reviewed versions

**Context:** editing an agent must not silently mutate the configuration currently published to users.

**Decision:** versions are immutable reviewable artifacts and publication points to a specific approved version.

**Tradeoff:** additional lifecycle records are required, while review, rollback and audit become clearer.

## ADR-003 — Server-owned approval policy

**Context:** approval rules must hold regardless of which client calls the API.

**Decision:** approval authorization is evaluated by the server rather than being enforced only through control-plane UI state.

**Tradeoff:** authorization logic is more explicit and testable.

## ADR-004 — Explicit production runtime configuration

**Context:** a missing provider configuration should not make production appear healthy by silently switching to a development runtime.

**Decision:** deterministic local runtime is explicit opt-in and unavailable as a silent production fallback.

**Tradeoff:** misconfigured deployments fail earlier and more visibly.

## ADR-005 — Asynchronous provisioning

**Context:** runtime/application provisioning can involve external systems and unpredictable latency.

**Decision:** use worker and queue boundaries for provisioning and long-running lifecycle work.

**Tradeoff:** idempotency, retries and job observability are required, while the API remains responsive and recoverable.
