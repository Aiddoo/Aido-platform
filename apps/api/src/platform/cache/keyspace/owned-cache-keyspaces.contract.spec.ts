import {
  ENTITLEMENT_CACHE_TTL_MS,
  EntitlementCacheKey,
} from "#api/modules/access/infrastructure/cache/entitlement/entitlement-cache.keyspace";
import {
  IDENTITY_CACHE_TTL_MS,
  IdentityCacheKey,
} from "#api/modules/identity/infrastructure/cache/auth/identity-cache.keyspace";
import {
  FOLLOW_CACHE_TTL_MS,
  FollowCacheKey,
} from "#api/modules/social/infrastructure/cache/friends/follow-cache.keyspace";
describe("Context별 캐시 키 — 기존 키와 TTL 호환", () => {
  describe("TTL 상수", () => {
    it("세션 TTL은 30초이다", () => {
      // Given
      const expectedTtl = 30_000;

      // When
      const actualTtl = IDENTITY_CACHE_TTL_MS.SESSION;

      // Then
      expect(actualTtl).toBe(expectedTtl);
    });

    it("사용자 프로필 TTL은 5분이다", () => {
      // Given
      const expectedTtl = 5 * 60_000;

      // When
      const actualTtl = IDENTITY_CACHE_TTL_MS.USER_PROFILE;

      // Then
      expect(actualTtl).toBe(expectedTtl);
    });

    it("구독 상태 TTL은 10분이다", () => {
      // Given
      const expectedTtl = 10 * 60_000;

      // When
      const actualTtl = ENTITLEMENT_CACHE_TTL_MS;

      // Then
      expect(actualTtl).toBe(expectedTtl);
    });

    it("상호 친구 TTL은 1분이다", () => {
      // Given
      const expectedTtl = 60_000;

      // When
      const actualTtl = FOLLOW_CACHE_TTL_MS.MUTUAL;

      // Then
      expect(actualTtl).toBe(expectedTtl);
    });
  });

  describe("키 빌더", () => {
    describe("session", () => {
      it("세션 키를 생성한다", () => {
        // Given
        const sessionId = "sess_123";

        // When
        const key = IdentityCacheKey.session(sessionId);

        // Then
        expect(key).toBe("aido:v1:auth:session:sess_123");
      });

      it("다양한 세션 ID 형식을 처리한다", () => {
        // Given
        const testCases = [
          { input: "abc123", expected: "aido:v1:auth:session:abc123" },
          {
            input: "session-with-dashes",
            expected: "aido:v1:auth:session:session-with-dashes",
          },
          {
            input: "session_with_underscores",
            expected: "aido:v1:auth:session:session_with_underscores",
          },
        ];

        // When & Then
        for (const { input, expected } of testCases) {
          expect(IdentityCacheKey.session(input)).toBe(expected);
        }
      });
    });

    describe("userProfile", () => {
      it("사용자 프로필 키를 생성한다", () => {
        // Given
        const userId = "user_1";

        // When
        const key = IdentityCacheKey.userProfile(userId);

        // Then
        expect(key).toBe("aido:v1:auth:user-profile:user_1");
      });

      it("UUID 형식을 처리한다", () => {
        // Given
        const uuid = "550e8400-e29b-41d4-a716-446655440000";

        // When
        const key = IdentityCacheKey.userProfile(uuid);

        // Then
        expect(key).toBe(`aido:v1:auth:user-profile:${uuid}`);
      });
    });

    describe("subscription", () => {
      it("구독 상태 키를 생성한다", () => {
        // Given
        const userId = "user_1";

        // When
        const key = EntitlementCacheKey.subscription(userId);

        // Then
        expect(key).toBe("aido:v1:subscription:status:user_1");
      });
    });

    describe("mutualFriend", () => {
      it("상호 친구 키를 생성한다", () => {
        // Given
        const userId = "user_1";
        const targetUserId = "user_2";

        // When
        const key = FollowCacheKey.mutual(userId, targetUserId);

        // Then
        expect(key).toBe("aido:v1:follow:mutual:user_1:user_2");
      });

      it("사용자 ID 순서를 유지한다", () => {
        // Given
        const userA = "user_a";
        const userB = "user_b";

        // When
        const key1 = FollowCacheKey.mutual(userA, userB);
        const key2 = FollowCacheKey.mutual(userB, userA);

        // Then
        expect(key1).toBe("aido:v1:follow:mutual:user_a:user_b");
        expect(key2).toBe("aido:v1:follow:mutual:user_b:user_a");
        expect(key1).not.toBe(key2);
      });
    });
  });

  describe("키 고유성", () => {
    it("서로 다른 도메인의 키는 고유하다", () => {
      // Given
      const id = "123";

      // When
      const sessionKey = IdentityCacheKey.session(id);
      const profileKey = IdentityCacheKey.userProfile(id);
      const subscriptionKey = EntitlementCacheKey.subscription(id);

      // Then
      expect(sessionKey).not.toBe(profileKey);
      expect(profileKey).not.toBe(subscriptionKey);
      expect(sessionKey).not.toBe(subscriptionKey);
    });

    it("서로 다른 사용자의 키는 고유하다", () => {
      // Given
      const userId1 = "user_1";
      const userId2 = "user_2";

      // When
      const key1 = IdentityCacheKey.userProfile(userId1);
      const key2 = IdentityCacheKey.userProfile(userId2);

      // Then
      expect(key1).not.toBe(key2);
    });
  });
});
