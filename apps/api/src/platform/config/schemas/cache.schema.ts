import { z } from "zod";

/**
 * 캐시 설정 스키마
 */
export const cacheSchema = z.object({
  CACHE_TYPE: z.enum(["memory", "redis"]).default("memory"),
  CACHE_DEFAULT_TTL_MS: z.coerce.number().int().positive().default(60000),
  CACHE_MAX_ITEMS: z.coerce.number().int().positive().default(1000),
  // lru-cache가 읽을 때 만료 항목을 지워 더는 쓰지 않는다. 운영 env 호환으로 검증만 남긴다
  CACHE_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).optional(),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

export type CacheEnvConfig = z.infer<typeof cacheSchema>;
