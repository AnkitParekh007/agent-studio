# Portfolio Roadmap — Agent Studio

## Now — make Agent Studio the canonical platform

- converge useful lifecycle/version/security ideas from earlier control-plane experiments here
- document agent definition → review → approval → provision → publish → revoke transitions
- keep provider-neutral runtime contracts explicit
- expand tests around stale, rejected, superseded and failed provisioning states

## Next — production operations

- add richer job/runtime observability and trace correlation
- strengthen idempotency around provisioning and lifecycle callbacks
- document secret rotation and runtime credential boundaries
- add operator-facing recovery workflows for failed provisioning

## Next — multi-surface publication proof

- show one approved version published consistently to hosted web, desktop and embed/API surfaces
- demonstrate that revoked/superseded publication loses runtime access
- keep development/local runtime behavior visually distinguishable from provider-backed runtime

## Later — provider and enterprise extensibility

- add a second runtime adapter only when it can share the same lifecycle contract
- add policy hooks for organization-specific approval and publishing rules
- add richer audit export and deployment guidance

## Quality gates

- no production fallback to deterministic local runtime
- every published application maps to an approved version
- long-running work is retry-safe and observable
- lifecycle/security changes update architecture decisions
