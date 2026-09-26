# MOVO API image. Build from the repo root:
#   docker build -f apps/api/Dockerfile -t movo-api .
# Multi-arch (what CI pushes to GHCR):
#   docker buildx build --platform linux/arm64,linux/amd64 -f apps/api/Dockerfile .
#
# Start command: `prisma migrate deploy`, then `node dist/main.js`.

ARG NODE_IMAGE=node:22-slim

# ---------- build: install, build shared libs + API, prune to production deps ----------
FROM ${NODE_IMAGE} AS build
ENV CI=true
# openssl here too: @prisma/engines picks the schema engine build by the OpenSSL it detects.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @movo/api...
# @movo/contracts and @movo/i18n first; the API imports their dist output.
RUN pnpm --filter @movo/contracts --filter @movo/i18n build \
 && pnpm --filter @movo/api db:generate \
 && pnpm --filter @movo/api build
# Production node_modules only. --legacy: pnpm 10 needs it without inject-workspace-packages.
# Install scripts must run: @prisma/engines fetches the schema engine that `migrate deploy` uses.
RUN pnpm --filter @movo/api --prod --legacy deploy /out \
 && cd /out \
 && rm -rf src tests dist docker Dockerfile vitest.config.ts tsconfig*.json *.tsbuildinfo \
 && cp -r /repo/apps/api/dist dist \
 && test -d node_modules/.pnpm/node_modules/prisma \
 && ln -s .pnpm/node_modules/prisma node_modules/prisma
# The Prisma CLI arrives as a peer of @prisma/client; the link above makes it resolvable from
# /app so prisma.config.ts (`import 'prisma/config'`) works for `migrate deploy` at start.

# ---------- runtime ----------
FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    API_PORT=4000 \
    TZ=Asia/Kolkata
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out /app
COPY apps/api/docker/start.sh /usr/local/bin/movo-start
RUN chmod 0755 /usr/local/bin/movo-start
EXPOSE 4000
# Code is owned by root and read-only to the app user.
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["movo-start"]
