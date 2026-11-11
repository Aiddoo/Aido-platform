import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const USER_SETTINGS_CACHE_TTL_MS = 10 * 60_000;
export const UserSettingsCacheKey = {
  preference: (userId: string) => cacheKey("user-settings", "preference", userId),
} as const;
