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
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

export type CacheEnvConfig = z.infer<typeof cacheSchema>;

/** 주소 없이 redis를 고르면 ioredis가 localhost로 붙으므로 시작을 거부한다 */
export function validateCacheConfig({
  value: config,
  issues,
}: z.core.ParsePayload<CacheEnvConfig & { readonly REDIS_URL?: string }>): void {
  if (config.CACHE_TYPE === "redis" && (config.REDIS_URL ?? "") === "") {
    issues.push({
      code: "custom",
      input: config,
      path: ["REDIS_URL"],
      message: "REDIS_URL is required when CACHE_TYPE=redis",
    });
  }
}
