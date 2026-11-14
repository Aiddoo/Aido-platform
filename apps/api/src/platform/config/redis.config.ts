import { defineConfig } from "./define-config.js";
import { cacheSchema } from "./schemas/cache.schema.js";
import { externalSchema } from "./schemas/external.schema.js";

const redisSchema = externalSchema.pick({ REDIS_URL: true }).extend(
  cacheSchema.pick({
    REDIS_COMMAND_TIMEOUT_MS: true,
    REDIS_CONNECT_TIMEOUT_MS: true,
  }).shape,
);

export const redisConfig = defineConfig(
  "redis",
  redisSchema.transform((env) => ({
    url: env.REDIS_URL,
    commandTimeoutMs: env.REDIS_COMMAND_TIMEOUT_MS,
    connectTimeoutMs: env.REDIS_CONNECT_TIMEOUT_MS,
  })),
  (env) => ({
    REDIS_URL: env.REDIS_URL,
    REDIS_COMMAND_TIMEOUT_MS: env.REDIS_COMMAND_TIMEOUT_MS,
    REDIS_CONNECT_TIMEOUT_MS: env.REDIS_CONNECT_TIMEOUT_MS,
  }),
);
