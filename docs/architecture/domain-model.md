# Domain model

## Agent lifecycle (product status)

`draft → waiting_for_approval → active ↔ inactive → terminated`

Lifecycle is separate from version review status.

## Version review status

`draft → waiting_for_approval → approved | rejected`

From `approved`: later edits create a new `draft`; previous approved versions become `superseded` when a newer version is approved. `archived` is terminal for a version snapshot.

## Rules

- Creating an agent creates draft version `1`.
- Submitting freezes a reviewable snapshot (status → waiting_for_approval).
- Approving does not mutate previous versions.
- Editing after approval creates a new draft version; production pointer stays.
- Rejection requires a reason.
- Rollback repoints `currentApprovedVersionId`.
- Every transition writes `agent_version_transitions` and `audit_events`.

## Key entities

- `Organization`, `Workspace`, `Membership`, `Role`, `Permission`
- `AgentDefinition` (stable identity + lifecycle + production pointers)
- `AgentVersion` (immutable executable snapshot)
- `ApprovalRequest` / `ApprovalDecision`
- `AgentDeployment` (platform deployment → provider resource IDs)
- `ApplicationDefinition` / `Publication`
- `RuntimeSession` / `RuntimeEvent` / `UsageRecord`
- `SecretReference` (pointer only; ciphertext elsewhere)
