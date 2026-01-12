# Base Stage
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Dependencies Stage
FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY turbo.json ./

COPY apps/api/package.json ./apps/api/
COPY packages/validators/package.json ./packages/validators/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY tooling/biome-config/package.json ./tooling/biome-config/

RUN pnpm install --frozen-lockfile

# Builder Stage
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages

COPY . .

RUN pnpm --filter @aido/api prisma generate
RUN pnpm --filter @aido/api build
RUN pnpm --filter @aido/api deploy --prod /app/production

# Runner Stage
FROM node:22-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/production ./
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/generated ./src/generated

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

USER nestjs

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health/liveness || exit 1

CMD ["node", "dist/main.js"]
