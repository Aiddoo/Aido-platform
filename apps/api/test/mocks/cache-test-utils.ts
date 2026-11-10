import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { AuthCachedUserProfile } from "#api/modules/identity/application/ports/auth/auth-collaboration.port";
import type { ICacheService } from "#api/platform/cache/interfaces/cache.interface";

/**
 * 캐시 테스트 헬퍼: Vitest Mock 생성
 */
export function createMockCacheService(): Mocked<ICacheService> {
  const cache = mockDeep<ICacheService>();
  cache.getStats.mockReturnValue({ hits: 0, misses: 0, keys: 0 });
  return cache;
}

/**
 * 캐시 테스트 헬퍼: 완전한 AuthCachedUserProfile mock 데이터 생성
 */
export function createMockUserProfile(
  overrides: Partial<AuthCachedUserProfile> = {},
): AuthCachedUserProfile {
  return {
    id: "user-123",
    email: "test@example.com",
    userTag: "ABC123",
    role: "USER",
    status: "ACTIVE",
    emailVerifiedAt: new Date().toISOString(),
    subscriptionStatus: "FREE",
    subscriptionExpiresAt: null,
    name: "Test User",
    profileImage: null,
    createdAt: new Date().toISOString(),
    providers: ["CREDENTIAL"],
    ...overrides,
  };
}
