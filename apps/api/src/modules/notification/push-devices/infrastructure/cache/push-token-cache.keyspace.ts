import type { GenerationGuardedCacheKey } from "#api/platform/cache/generation-guarded-cache";
import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const PUSH_TOKEN_CACHE_TTL_MS = {
  PUSH_TOKENS: 5 * 60_000,
} as const;

export const PushTokenCacheKey = {
  pushTokens: (userId: string) => cacheKey("notification", "push-tokens", userId),
  pushTokensGeneration: (userId: string) =>
    cacheKey("notification", "push-tokens-generation", userId),
} as const;

// 조회와 무효화가 같은 값·세대 키를 쓴다
export function pushTokensCacheKey(userId: string): GenerationGuardedCacheKey {
  return {
    valueKey: PushTokenCacheKey.pushTokens(userId),
    generationKey: PushTokenCacheKey.pushTokensGeneration(userId),
  };
}
