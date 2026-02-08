import { z } from "zod";

/**
 * 캐시 설정 스키마
 */
export const cacheSchema = z.object({
	CACHE_TYPE: z.enum(["memory", "redis"]).default("memory"),
	CACHE_DEFAULT_TTL_MS: z.coerce.number().int().positive().default(60000),
	CACHE_MAX_ITEMS: z.coerce.number().int().positive().default(1000),
	CACHE_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
	REDIS_HOST: z.string().optional(),
	REDIS_PORT: z.coerce.number().int().positive().optional(),
	REDIS_PASSWORD: z.string().optional(),
	REDIS_DB: z.coerce.number().int().min(0).optional(),
});

export type CacheEnvConfig = z.infer<typeof cacheSchema>;
