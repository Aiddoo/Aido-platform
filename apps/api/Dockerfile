# Stage 1: base - Node + pnpm
FROM node:24.20.0-alpine3.24 AS base
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app


# Stage 2: deps - 의존성 설치
FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY turbo.json ./

# Workspace package.json 복사 (tooling 포함)
COPY apps/api/package.json ./apps/api/
COPY packages/errors/package.json ./packages/errors/
COPY packages/utils/package.json ./packages/utils/
COPY packages/validators/package.json ./packages/validators/
COPY tooling/jest/package.json ./tooling/jest/
COPY tooling/typescript/package.json ./tooling/typescript/
COPY tooling/vitest/package.json ./tooling/vitest/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Stage 3: builder - 빌드
FROM base AS builder

COPY --from=deps /app ./

COPY . .

# Workspace 패키지 빌드 (순서 중요: errors → utils → validators)
RUN pnpm --filter @aido/errors build && \
    pnpm --filter @aido/utils build && \
    pnpm --filter @aido/validators build

# Prisma generate + API build
RUN cd apps/api && pnpm prisma generate
RUN pnpm --filter @aido/api build

# Production 의존성만 추출
RUN pnpm --filter @aido/api deploy --legacy --prod /app/production


# Stage 4: migrate - Prisma 마이그레이션 (경량화)
FROM node:24.20.0-alpine3.24 AS migrate
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app/apps/api

# Prisma 관련 파일만 복사
COPY apps/api/prisma ./prisma
COPY apps/api/prisma.config.ts ./
COPY apps/api/scripts/migrate.sh ./scripts/migrate.sh
# prisma.config.ts가 require하는 문지기 — 없으면 이 이미지의 모든 Prisma 명령이 죽는다.
COPY apps/api/scripts/guard-database-url.cjs ./scripts/guard-database-url.cjs

# 빈 프로젝트에 migration CLI만 설치 (workspace/catalog 의존 회피)
# 정본은 apps/api/package.json이다. 런타임 버전 변경 시 이 exact pin도 같은 PR에서 맞춘다.
RUN pnpm init && pnpm add prisma@7.10.0 pg-boss@12.27.0 && chmod 0755 ./scripts/migrate.sh

# RDS CA 인증서
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-ca.pem
ENV NODE_EXTRA_CA_CERTS=/app/certs/rds-ca.pem

RUN pnpm prisma generate

CMD ["./scripts/migrate.sh"]


# Stage 5: development - 개발 핫리로드
FROM base AS development

COPY --from=deps /app ./
COPY . .

RUN pnpm --filter @aido/errors build && \
    pnpm --filter @aido/utils build && \
    pnpm --filter @aido/validators build

RUN cd apps/api && pnpm prisma generate

WORKDIR /app/apps/api

ENV NODE_ENV=development
EXPOSE 8080

CMD ["pnpm", "dev"]

# Stage 6: production - 최종 런타임
FROM node:24.20.0-alpine3.24 AS production

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Production deps + Prisma client
COPY --from=builder --chown=nestjs:nodejs /app/production ./
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/generated ./src/generated
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

# ADD의 --chmod가 새로 생성된 상위 디렉터리에도 적용되지 않도록 먼저 권한을 고정
RUN mkdir -p /app/certs && \
    chown nestjs:nodejs /app/certs && \
    chmod 0755 /app/certs

# RDS CA 인증서 다운로드 (COPY 이후에 배치 — nestjs 유저가 읽을 수 있도록 chown)
ADD --chmod=644 --chown=nestjs:nodejs https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-ca.pem

ENV NODE_ENV=production
ENV PORT=8080
ENV NODE_EXTRA_CA_CERTS=/app/certs/rds-ca.pem

EXPOSE 8080

USER nestjs

# non-root 런타임에서 CA를 읽을 수 없는 이미지는 빌드 단계에서 차단
RUN test -r "$NODE_EXTRA_CA_CERTS"

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "--max-old-space-size=384", "dist/src/main.js"]
