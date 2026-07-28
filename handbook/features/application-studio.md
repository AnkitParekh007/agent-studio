# Application Studio

Turn an approved agent into a branded product.

## Templates

`packages/application-templates` ships starter templates (for example `general_assistant`) with a typed `studioConfig` schema — logo, copy, starter prompts, layout hints.

## Builder flow

1. Pick template + bind agent
2. Adjust branding / studio config
3. Publish channels when deployment is `ready`

## Hosted runtime

`apps/agent-web-runtime` serves `/{orgSlug}/{appSlug}` for active `hosted_web` publications.

> [!TIP]
> Application Studio is where AI meets product design. Keep model prompts in the agent version; keep UX chrome in the application.
