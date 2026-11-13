FROM node:26.13.1-alpine3.24 AS base
WORKDIR /app
ENV TZ=UTC
ENV COREPACK_HOME=/usr/local/share/corepack
ENV pnpm_config_verify_deps_before_run=false
# Node 25부터 공식 이미지에 corepack이 없어 npm으로 설치한다.
RUN apk upgrade --no-cache && npm install --global corepack@0.36.0 && corepack enable && apk add --no-cache openssl

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
RUN pnpm --filter @aido/server build
RUN pnpm --filter @aido/server deploy --legacy --prod --prefer-offline /app/production

FROM deps AS development
COPY --from=pruner /app/out/api/full/ ./
RUN pnpm --filter @aido/api build
WORKDIR /app/apps/api
ENV NODE_ENV=development
EXPOSE 8080
CMD ["pnpm", "dev"]

FROM base AS migrate-deps
COPY --from=pruner /app/out/migrate/json/ ./
COPY --from=pruner /app/out/migrate/pnpm-lock.yaml ./pnpm-lock.yaml
# store·metadata 캐시(약 400MB)가 이미지 층에 남지 않게 빌드 캐시 마운트에 둔다. 파일은 node_modules로 복사된다.
RUN --mount=type=cache,id=pnpm-migrate,target=/pnpm \
    pnpm install --prod --frozen-lockfile --ignore-scripts --store-dir=/pnpm/store --config.cache-dir=/pnpm/cache && \
    chmod a+r pnpm-workspace.yaml

FROM migrate-deps AS migrate
COPY --from=pruner /app/out/migrate/full/tooling/database-migrate/ ./tooling/database-migrate/
COPY apps/api/drizzle/ ./apps/api/drizzle/
COPY apps/api/scripts/guard-database-url.cjs ./apps/api/scripts/
# 실행 시점은 corepack pnpm만 쓴다. 베이스 이미지 번들 npm의 취약 의존성이 운영 이미지에 남지 않게 걷어 낸다.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx && \
    addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 migrate && \
    mkdir -p /app/certs && chmod 0755 /app/certs
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-ca.pem
ENV NODE_EXTRA_CA_CERTS=/app/certs/rds-ca.pem
WORKDIR /app/tooling/database-migrate
USER migrate
RUN test -r "$NODE_EXTRA_CA_CERTS"
CMD ["pnpm", "db:deploy"]

FROM node:26.13.1-alpine3.24 AS production
WORKDIR /app
# 운영 서버는 node로만 실행한다. 베이스 이미지 번들 npm의 취약 의존성이 운영 이미지에 남지 않게 걷어 낸다.
RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx && \
    addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs && \
    mkdir -p /app/certs && chmod 0755 /app/certs
COPY --from=builder --chown=nestjs:nodejs /app/production/ ./
ADD --chmod=644 --chown=nestjs:nodejs https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-ca.pem
ENV TZ=UTC
ENV NODE_ENV=production
ENV PORT=8080
ENV NODE_EXTRA_CA_CERTS=/app/certs/rds-ca.pem
EXPOSE 8080
USER nestjs
RUN test -r "$NODE_EXTRA_CA_CERTS"
# start-interval(Docker 25+): 기동 중에는 2초마다 확인해 배포 헬스 게이트를 빨리 통과한다
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --start-interval=2s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
CMD ["node", "--max-old-space-size=384", "dist/src/bootstrap.js"]
