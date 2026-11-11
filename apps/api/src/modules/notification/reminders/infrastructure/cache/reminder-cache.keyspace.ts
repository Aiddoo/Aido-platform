import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const REMINDER_CACHE_TTL_MS = 5 * 60_000;
export const ReminderCacheKey = {
  activeTimezones: () => cacheKey("scheduler", "active-timezones"),
} as const;
