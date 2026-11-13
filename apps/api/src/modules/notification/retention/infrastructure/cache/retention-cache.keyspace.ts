import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

// PG 시간대 목록은 DB 업그레이드 때만 바뀐다. 하루면 업그레이드 뒤에도 곧 맞춰진다
export const RETENTION_CACHE_TTL_MS = {
  POSTGRES_TIMEZONE_NAMES: 24 * 60 * 60_000,
} as const;

export const RetentionCacheKey = {
  postgresTimezoneNames: () => cacheKey("retention", "postgres-timezone-names"),
} as const;
