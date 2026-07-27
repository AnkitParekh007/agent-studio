FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@8.7.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/control-plane-web/package.json apps/control-plane-web/
COPY apps/agent-web-runtime/package.json apps/agent-web-runtime/
COPY apps/embed-runtime/package.json apps/embed-runtime/
COPY apps/desktop-shell/package.json apps/desktop-shell/
COPY packages/application-templates/package.json packages/application-templates/
COPY packages/auth/package.json packages/auth/
COPY packages/authorization/package.json packages/authorization/
COPY packages/config/package.json packages/config/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/embed-sdk/package.json packages/embed-sdk/
COPY packages/integrations/package.json packages/integrations/
COPY packages/runtime-claude/package.json packages/runtime-claude/
COPY packages/runtime-core/package.json packages/runtime-core/
COPY packages/runtime-local/package.json packages/runtime-local/
COPY packages/testing/package.json packages/testing/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build \
  --filter=@agent-studio/api \
  --filter=@agent-studio/worker \
  --filter=@agent-studio/control-plane-web \
  --filter=@agent-studio/agent-web-runtime \
  --filter=@agent-studio/embed-runtime

# Single runtime image: Compose overrides command per service (api/worker/migrate/web/seed).
FROM base AS backend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app /app
WORKDIR /app
# Next.js writes .next/cache at runtime and pnpm needs a writable store dir.
ENV npm_config_cache=/tmp/.npm
ENV XDG_CACHE_HOME=/tmp/.cache
USER node
EXPOSE 3000 3001 3002 4000
CMD ["node", "apps/api/dist/main.js"]
