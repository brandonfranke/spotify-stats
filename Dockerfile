# syntax=docker/dockerfile:1

# ---- Build ------------------------------------------------------------------
FROM oven/bun:1.3.13 AS build
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile
# No secrets are needed to build; deployment values are resolved at runtime.
RUN bun run --cwd apps/web build

# ---- Runtime ----------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
RUN chown node:node /app
USER node

# Varlock validates and loads the runtime environment from .env.schema at boot.
# Installed as the runtime user because it marks its native helper executable.
RUN npm install --no-save --no-audit --no-fund varlock@1.25.0 \
 && npm cache clean --force
COPY --chown=node:node --from=build /repo/apps/web/.env.schema ./.env.schema
COPY --chown=node:node --from=build /repo/apps/web/.output ./.output

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]