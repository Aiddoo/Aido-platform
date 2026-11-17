import type { CachedUserProfile } from "#api/modules/identity/users/application/ports/user-profile-cache.port";

// 캐시 저장소에 직접 넣는 값이라 사용자 id는 저장 모양(문자열)이다
type StoredUserProfile = Omit<CachedUserProfile, "id"> & { id: string };

export function createMockUserProfile(
  overrides: Partial<StoredUserProfile> = {},
): StoredUserProfile {
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
