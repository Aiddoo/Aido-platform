import { defineConfig } from "./define-config.js";
import { cacheSchema } from "./schemas/cache.schema.js";
import { externalSchema } from "./schemas/external.schema.js";

const redisSchema = externalSchema.pick({ REDIS_URL: true }).extend(
  cacheSchema.pick({
    REDIS_HOST: true,
    REDIS_PORT: true,
    REDIS_PASSWORD: true,
    REDIS_DB: true,
    REDIS_COMMAND_TIMEOUT_MS: true,
    REDIS_CONNECT_TIMEOUT_MS: true,
  }).shape,
);

/** `url`이 있으면 host·port·password·db보다 우선한다. */
export const redisConfig = defineConfig(
  "redis",
  redisSchema.transform((env) => ({
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    commandTimeoutMs: env.REDIS_COMMAND_TIMEOUT_MS,
    connectTimeoutMs: env.REDIS_CONNECT_TIMEOUT_MS,
  })),
  (env) => ({
    REDIS_URL: env.REDIS_URL,
    REDIS_HOST: env.REDIS_HOST,
    REDIS_PORT: env.REDIS_PORT,
    REDIS_PASSWORD: env.REDIS_PASSWORD,
    REDIS_DB: env.REDIS_DB,
    REDIS_COMMAND_TIMEOUT_MS: env.REDIS_COMMAND_TIMEOUT_MS,
    REDIS_CONNECT_TIMEOUT_MS: env.REDIS_CONNECT_TIMEOUT_MS,
  }),
);
