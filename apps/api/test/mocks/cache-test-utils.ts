import type { AuthCachedUserProfile } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";

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
