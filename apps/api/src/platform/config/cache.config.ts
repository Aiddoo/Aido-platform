import type { ConfigType } from "@nestjs/config";
import type { Redis } from "ioredis";

import { defineConfig } from "./define-config.js";
import { cacheSchema } from "./schemas/cache.schema.js";

export const cacheConfig = defineConfig(
  "cache",
  cacheSchema
    .pick({
      CACHE_TYPE: true,
      CACHE_DEFAULT_TTL_MS: true,
      CACHE_MAX_ITEMS: true,
    })
    .transform((env) => ({
      type: env.CACHE_TYPE,
      defaultTtlMs: env.CACHE_DEFAULT_TTL_MS,
      maxItems: env.CACHE_MAX_ITEMS,
    })),
  (env) => ({
    CACHE_TYPE: env.CACHE_TYPE,
    CACHE_DEFAULT_TTL_MS: env.CACHE_DEFAULT_TTL_MS,
    CACHE_MAX_ITEMS: env.CACHE_MAX_ITEMS,
  }),
);

/** CACHE_TYPE=redis이고 연결이 있으면 그 Redis를, 아니면 null(프로세스 안 저장소)을 준다. 캐시·잠금·중복 방지·스로틀이 같은 판단을 쓴다. */
export function selectSharedRedis(
  cache: Pick<ConfigType<typeof cacheConfig>, "type">,
  redis: Redis | null | undefined,
): Redis | null {
  return cache.type === "redis" ? (redis ?? null) : null;
}
