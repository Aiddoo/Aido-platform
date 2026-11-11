import { defineConfig } from "./define-config.js";
import { databaseSchema } from "./schemas/database.schema.js";

// 세션 statement_timeout(15초)보다 길어 평소에는 서버가 먼저 취소하고, DB가 응답하지 않을 때만 클라이언트가 끊는다
const QUERY_TIMEOUT_MS = 20_000;

export const databaseConfig = defineConfig(
  "database",
  databaseSchema.transform((env) => ({
    url: env.DATABASE_URL,
    poolMax: env.DATABASE_POOL_MAX,
    idleTimeoutMs: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    queryTimeoutMs: QUERY_TIMEOUT_MS,
    allowUnverifiedTls: env.DATABASE_SSL_ALLOW_UNVERIFIED,
  })),
  (env) => ({
    DATABASE_URL: env.DATABASE_URL,
    DATABASE_POOL_MAX: env.DATABASE_POOL_MAX,
    DATABASE_POOL_IDLE_TIMEOUT_MS: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    DATABASE_POOL_CONNECTION_TIMEOUT_MS: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    DATABASE_SSL_ALLOW_UNVERIFIED: env.DATABASE_SSL_ALLOW_UNVERIFIED,
  }),
);
