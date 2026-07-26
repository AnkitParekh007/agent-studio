# Playground

The Playground lets creators test agent versions before or after approval.

## Capabilities (Phase 4)

- Select an organization agent and a specific version (draft or approved)
- Start a session through `/api/playground/sessions`
- Stream normalized runtime events over SSE
- Stop execution, retry the last prompt, and reset the conversation UI
- View usage totals and an execution timeline
- Toggle developer diagnostics separately from the conversation pane

## Runtime behavior

- Prefer an existing ready deployment for the selected version
- Otherwise provision an ephemeral playground deployment through `AgentRuntimeAdapter`
- Local runtime remains development-only and is labeled in the UI
- Claude runtime requires `ANTHROPIC_API_KEY` and fails closed when unset

## Security

Playground routes require authentication and `agent:write` / `agent:read` permissions. All events are redacted before persistence and streaming.
