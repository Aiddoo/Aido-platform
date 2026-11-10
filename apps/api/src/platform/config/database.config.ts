import { defineConfig } from "./define-config.js";
import { databaseSchema } from "./schemas/database.schema.js";

export const databaseConfig = defineConfig(
  "database",
  databaseSchema.transform((env) => ({
    url: env.DATABASE_URL,
    poolMax: env.DATABASE_POOL_MAX,
    idleTimeoutMs: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
  })),
  (env) => ({
    DATABASE_URL: env.DATABASE_URL,
    DATABASE_POOL_MAX: env.DATABASE_POOL_MAX,
    DATABASE_POOL_IDLE_TIMEOUT_MS: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    DATABASE_POOL_CONNECTION_TIMEOUT_MS: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
  }),
);
