import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const IDENTITY_CACHE_TTL_MS = { SESSION: 30_000, USER_PROFILE: 5 * 60_000 } as const;
export const IdentityCacheKey = {
  session: (sessionId: string) => cacheKey("auth", "session", sessionId),
  userProfile: (userId: string) => cacheKey("auth", "user-profile", userId),
} as const;
