import { z } from "zod";

/** 캐시·잠금·중복 방지·스로틀이 함께 쓰는 저장소. 인스턴스가 1대라 모든 배포 환경의 기본값이 memory다. */
const CACHE_TYPES = ["memory", "redis"] as const;

/**
 * 캐시 설정 스키마
 */
export const cacheSchema = z.object({
  CACHE_TYPE: z.enum(CACHE_TYPES).default("memory"),
  CACHE_DEFAULT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  CACHE_MAX_ITEMS: z.coerce.number().int().positive().default(1000),
  // lru-cache가 읽을 때 만료 항목을 지워 더는 쓰지 않는다. 운영 env 호환으로 검증만 남긴다
  CACHE_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).optional(),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

export type CacheEnvConfig = z.infer<typeof cacheSchema>;
