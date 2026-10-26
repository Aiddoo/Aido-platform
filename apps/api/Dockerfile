FROM node:24.22.1-alpine3.24 AS base
WORKDIR /app
ENV COREPACK_HOME=/usr/local/share/corepack
ENV pnpm_config_verify_deps_before_run=false
COPY package.json ./
RUN apk upgrade --no-cache && corepack enable && apk add --no-cache openssl

FROM base AS pruner
COPY . .
RUN pnpm dlx "turbo@$(node -p 'require("./package.json").devDependencies.turbo')" prune @aido/server --docker --out-dir=out/api && \
    pnpm dlx "turbo@$(node -p 'require("./package.json").devDependencies.turbo')" prune @aido/database-migrate --docker --out-dir=out/migrate

FROM base AS deps
COPY --from=pruner /app/out/api/json/ ./
COPY --from=pruner /app/out/api/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm rebuild argon2 @swc/core

FROM deps AS builder
COPY --from=pruner /app/out/api/full/ ./
RUN pnpm --filter @aido/api build
RUN pnpm --filter @aido/server db:generate && pnpm --filter @aido/server build
RUN pnpm --filter @aido/server deploy --legacy --prod --prefer-offline /app/production

FROM deps AS development
COPY --from=pruner /app/out/api/full/ ./
RUN pnpm --filter @aido/api build
RUN pnpm --filter @aido/server db:generate
WORKDIR /app/apps/api
ENV NODE_ENV=development
EXPOSE 8080
CMD ["pnpm", "dev"]

FROM base AS migrate-deps
COPY --from=pruner /app/out/migrate/json/ ./
COPY --from=pruner /app/out/migrate/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --frozen-lockfile --ignore-scripts && \
    chmod a+r pnpm-workspace.yaml && \
    pnpm --filter @aido/database-migrate exec prisma --version

FROM migrate-deps AS migrate
COPY --from=pruner /app/out/migrate/full/tooling/database-migrate/ ./tooling/database-migrate/
COPY apps/api/prisma/ ./apps/api/prisma/
COPY apps/api/prisma.config.ts ./apps/api/
COPY apps/api/src/prisma/contract.prisma ./apps/api/src/prisma/
COPY apps/api/scripts/guard-database-url.cjs apps/api/scripts/migrate.sh ./apps/api/scripts/
RUN pnpm --filter @aido/database-migrate exec prisma contract emit --format human
# 실행 시점은 corepack pnpm만 쓴다. 베이스 이미지 번들 npm의 취약 의존성이 운영 이미지에 남지 않게 걷어 낸다.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 migrate
RUN mkdir -p /app/certs && chmod 0755 /app/certs
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-ca.pem
ENV NODE_EXTRA_CA_CERTS=/app/certs/rds-ca.pem
WORKDIR /app/tooling/database-migrate
USER migrate
RUN test -r "$NODE_EXTRA_CA_CERTS"
CMD ["pnpm", "db:deploy"]

FROM node:24.22.1-alpine3.24 AS production
WORKDIR /app
# 운영 서버는 node로만 실행한다. 베이스 이미지 번들 npm의 취약 의존성이 운영 이미지에 남지 않게 걷어 낸다.
RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/production/ ./
RUN mkdir -p /app/certs && chmod 0755 /app/certs
ADD --chmod=644 --chown=nestjs:nodejs https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-ca.pem
ENV NODE_ENV=production
ENV PORT=8080
ENV NODE_EXTRA_CA_CERTS=/app/certs/rds-ca.pem
EXPOSE 8080
USER nestjs
RUN test -r "$NODE_EXTRA_CA_CERTS"
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
CMD ["node", "--max-old-space-size=384", "dist/src/bootstrap.js"]
