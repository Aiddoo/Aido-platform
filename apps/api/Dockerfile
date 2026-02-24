# Stage 1: base - Node + pnpm
FROM node:22-alpine AS base
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
COPY tooling/biome/package.json ./tooling/biome/
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
RUN pnpm --filter @aido/api deploy --prod /app/production


# Stage 4: migrate - Prisma 마이그레이션
FROM base AS migrate

COPY --from=deps /app ./
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/

WORKDIR /app/apps/api

RUN pnpm prisma generate

CMD ["pnpm", "prisma", "migrate", "deploy"]


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
FROM node:22-alpine AS production

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Production deps + Prisma client
COPY --from=builder --chown=nestjs:nodejs /app/production ./
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/generated ./src/generated
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

USER nestjs

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "dist/main.js"]
