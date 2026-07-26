# Application Studio

Application Studio turns an **approved** agent into a branded hosted application.

## Flow

1. Pick an approved agent and a template.
2. Edit branding, welcome copy, starter prompts, feature flags, and footer links.
3. Publish to hosted web: `/{orgSlug}/{appSlug}` on the agent-web-runtime (`:3001` locally).
4. End users chat through the Agent Gateway; clients never receive provider secrets.

## Templates

Shipped in `@agent-studio/application-templates`:

- `general_assistant`
- `internal_knowledge_copilot`
- `developer_composer`
- `customer_support_assistant`
- `data_analysis_workspace`
- `guided_workflow_assistant`

Each template seeds a full `studioConfig` (theme, layout, flags, links). Editors can override any field before publish.

## Studio config (public)

Public app responses include branding/UX only:

- theme colors, typography, layout
- welcome message and starter prompts
- feature flags (upload/voice/feedback/footer — some UI is reserved for later)
- terms / privacy / support contact

No API keys, MCP credentials, or admin tokens are exposed.

## Control plane

- `/applications` — list + create from template
- `/applications/{id}` — branding editor, live preview, publish
