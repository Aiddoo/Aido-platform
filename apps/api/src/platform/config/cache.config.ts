import { defineConfig } from "./define-config.js";
import { cacheSchema } from "./schemas/cache.schema.js";

export const cacheConfig = defineConfig(
  "cache",
  cacheSchema
    .pick({
      CACHE_TYPE: true,
      CACHE_DEFAULT_TTL_MS: true,
      CACHE_MAX_ITEMS: true,
      CACHE_CLEANUP_INTERVAL_MS: true,
    })
    .transform((env) => ({
      type: env.CACHE_TYPE,
      defaultTtlMs: env.CACHE_DEFAULT_TTL_MS,
      maxItems: env.CACHE_MAX_ITEMS,
      cleanupIntervalMs: env.CACHE_CLEANUP_INTERVAL_MS,
    })),
  (env) => ({
    CACHE_TYPE: env.CACHE_TYPE,
    CACHE_DEFAULT_TTL_MS: env.CACHE_DEFAULT_TTL_MS,
    CACHE_MAX_ITEMS: env.CACHE_MAX_ITEMS,
    CACHE_CLEANUP_INTERVAL_MS: env.CACHE_CLEANUP_INTERVAL_MS,
  }),
);
