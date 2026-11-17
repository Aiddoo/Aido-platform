import type { INestApplication } from "@nestjs/common";
/**
 * 캐시 무효화 통합 테스트
 *
 * @description
 * 캐시 무효화 시나리오를 실제 환경과 유사하게 테스트합니다.
 * 캐시 모듈의 전체 라이프사이클과 무효화 동작을 검증합니다.
 */
import { ConfigModule, registerAs } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { vi } from "vitest";
import { z } from "zod";

import {
  EntitlementCacheKey,
  ENTITLEMENT_CACHE_TTL_MS,
} from "#api/modules/access/feature-grants/infrastructure/cache/entitlement-cache.keyspace";
import {
  IdentityCacheKey,
  IDENTITY_CACHE_TTL_MS,
} from "#api/modules/identity/auth/infrastructure/cache/identity-cache.keyspace";
import {
  FriendshipCacheKey,
  FRIENDSHIP_CACHE_TTL_MS,
} from "#api/modules/social/friends/infrastructure/cache/friendship-cache.keyspace";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { CacheModule } from "#api/platform/cache/cache.module";
import { cachePattern } from "#api/platform/cache/keyspace/cache-key";
import { cacheConfig } from "#api/platform/config/cache.config";

import { createMockUserProfile } from "../mocks/cache-test-utils.js";

describe("캐시 무효화 통합 테스트 (Memory adapter)", () => {
  let app: INestApplication;
  let cacheService: CacheStorePort;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            registerAs(cacheConfig.namespace, () =>
              cacheConfig.parse({
                CACHE_TYPE: "memory",
                CACHE_DEFAULT_TTL_MS: 60_000,
                CACHE_MAX_ITEMS: 1000,
              }),
            ),
          ],
        }),
        CacheModule.forRoot(),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cacheService = moduleFixture.get(CacheStorePort);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cacheService.reset();
  });

  describe("세션 캐시 무효화 시나리오", () => {
    it("로그인 후 세션이 캐시되고 로그아웃 시 무효화된다", async () => {
      // Given
      const sessionId = "sess_integration_test_123";
      const session = {
        userId: "user_integration_1",
        expiresAt: new Date(Date.now() + 3_600_000),
        revokedAt: null,
      };

      // When
      await cacheService.set(
        IdentityCacheKey.session(sessionId),
        session,
        IDENTITY_CACHE_TTL_MS.SESSION,
      );

      // Then
      const cachedSession = await cacheService.get(
        IdentityCacheKey.session(sessionId),
        z.unknown(),
      );
      expect(cachedSession).toEqual(session);

      // When
      await cacheService.del(IdentityCacheKey.session(sessionId));

      // Then
      const afterLogout = await cacheService.get(IdentityCacheKey.session(sessionId), z.unknown());
      expect(afterLogout).toBeUndefined();
    });

    it("세션 TTL 만료 시 자동으로 삭제된다", async () => {
      // Given
      const baseTime = Date.now();
      const now = vi.spyOn(Date, "now").mockReturnValue(baseTime);
      const shortTtlModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              registerAs(cacheConfig.namespace, () =>
                cacheConfig.parse({
                  CACHE_TYPE: "memory",
                  CACHE_DEFAULT_TTL_MS: 50,
                  CACHE_MAX_ITEMS: 100,
                }),
              ),
            ],
          }),
          CacheModule.forRoot(),
        ],
      }).compile();

      const shortTtlApp = shortTtlModule.createNestApplication();
      try {
        await shortTtlApp.init();
        const shortTtlCache = shortTtlModule.get(CacheStorePort);

        const sessionId = "sess_short_ttl";
        const session = {
          userId: "user_ttl",
          expiresAt: new Date(),
          revokedAt: null,
        };

        // setSession은 고정 TTL 30초를 쓰므로 짧은 TTL을 직접 지정
        await shortTtlCache.set(IdentityCacheKey.session(sessionId), session, 50);
        expect(await shortTtlCache.get(IdentityCacheKey.session(sessionId), z.unknown())).toEqual(
          session,
        );

        // When
        now.mockReturnValue(baseTime + 100);

        // Then
        const afterExpiry = await shortTtlCache.get(
          IdentityCacheKey.session(sessionId),
          z.unknown(),
        );
        expect(afterExpiry).toBeUndefined();
      } finally {
        now.mockRestore();
        await shortTtlApp.close();
      }
    });
  });

  describe("사용자 프로필 캐시 무효화 시나리오", () => {
    it("프로필 수정 시 캐시가 무효화된다", async () => {
      // Given
      const userId = "user_profile_integration";
      const originalProfile = createMockUserProfile({
        id: userId,
        email: "original@test.com",
        name: "Original Name",
        userTag: "original#1234",
      });
      await cacheService.set(
        IdentityCacheKey.userProfile(userId),
        originalProfile,
        IDENTITY_CACHE_TTL_MS.USER_PROFILE,
      );
      const cachedProfile = await cacheService.get(
        IdentityCacheKey.userProfile(userId),
        z.unknown(),
      );
      expect(cachedProfile).toEqual(originalProfile);

      // When
      await cacheService.del(IdentityCacheKey.userProfile(userId));

      // Then
      const afterUpdate = await cacheService.get(IdentityCacheKey.userProfile(userId), z.unknown());
      expect(afterUpdate).toBeUndefined();

      // When
      const updatedProfile = createMockUserProfile({
        ...originalProfile,
        name: "Updated Name",
      });
      await cacheService.set(
        IdentityCacheKey.userProfile(userId),
        updatedProfile,
        IDENTITY_CACHE_TTL_MS.USER_PROFILE,
      );

      // Then
      const newCachedProfile = await cacheService.get(
        IdentityCacheKey.userProfile(userId),
        z.unknown(),
      );
      expect(newCachedProfile).toEqual(updatedProfile);
    });

    it("여러 사용자 프로필이 독립적으로 관리된다", async () => {
      // Given
      const users = [
        createMockUserProfile({
          id: "user_1",
          email: "u1@test.com",
          name: "User 1",
          userTag: "u1#1",
        }),
        createMockUserProfile({
          id: "user_2",
          email: "u2@test.com",
          name: "User 2",
          userTag: "u2#2",
        }),
        createMockUserProfile({
          id: "user_3",
          email: "u3@test.com",
          name: "User 3",
          userTag: "u3#3",
        }),
      ];

      for (const user of users) {
        await cacheService.set(
          IdentityCacheKey.userProfile(user.id),
          user,
          IDENTITY_CACHE_TTL_MS.USER_PROFILE,
        );
      }

      // When
      await cacheService.del(IdentityCacheKey.userProfile("user_2"));

      // Then
      expect(await cacheService.get(IdentityCacheKey.userProfile("user_1"), z.unknown())).toEqual(
        users[0],
      );
      expect(
        await cacheService.get(IdentityCacheKey.userProfile("user_2"), z.unknown()),
      ).toBeUndefined();
      expect(await cacheService.get(IdentityCacheKey.userProfile("user_3"), z.unknown())).toEqual(
        users[2],
      );
    });
  });

  describe("친구 관계 캐시 무효화 시나리오", () => {
    it("친구 추가/삭제 시 관련 캐시가 패턴으로 무효화된다", async () => {
      // Given
      const userId = "user_friend_integration";
      await cacheService.set(
        FriendshipCacheKey.mutual(userId, "friend_1"),
        true,
        FRIENDSHIP_CACHE_TTL_MS.MUTUAL,
      );
      await cacheService.set(
        FriendshipCacheKey.mutual(userId, "friend_2"),
        true,
        FRIENDSHIP_CACHE_TTL_MS.MUTUAL,
      );
      await cacheService.set(
        FriendshipCacheKey.mutual(userId, "friend_3"),
        false,
        FRIENDSHIP_CACHE_TTL_MS.MUTUAL,
      );

      // Then
      expect(
        await cacheService.get(FriendshipCacheKey.mutual(userId, "friend_1"), z.unknown()),
      ).toBe(true);
      expect(
        await cacheService.get(FriendshipCacheKey.mutual(userId, "friend_2"), z.unknown()),
      ).toBe(true);
      expect(
        await cacheService.get(FriendshipCacheKey.mutual(userId, "friend_3"), z.unknown()),
      ).toBe(false);

      // When
      const deletedCount = await cacheService.delByPattern(
        cachePattern("follow", "mutual", userId),
      );

      // Then
      expect(deletedCount).toBe(3);
      expect(
        await cacheService.get(FriendshipCacheKey.mutual(userId, "friend_1"), z.unknown()),
      ).toBeUndefined();
      expect(
        await cacheService.get(FriendshipCacheKey.mutual(userId, "friend_2"), z.unknown()),
      ).toBeUndefined();
      expect(
        await cacheService.get(FriendshipCacheKey.mutual(userId, "friend_3"), z.unknown()),
      ).toBeUndefined();
    });

    it("양방향 친구 관계가 독립적으로 캐시된다", async () => {
      // Given
      await cacheService.set(
        FriendshipCacheKey.mutual("user_a", "user_b"),
        true,
        FRIENDSHIP_CACHE_TTL_MS.MUTUAL,
      );
      await cacheService.set(
        FriendshipCacheKey.mutual("user_b", "user_a"),
        true,
        FRIENDSHIP_CACHE_TTL_MS.MUTUAL,
      );

      // When
      await cacheService.delByPattern(cachePattern("follow", "mutual", "user_a"));

      // Then
      expect(
        await cacheService.get(FriendshipCacheKey.mutual("user_a", "user_b"), z.unknown()),
      ).toBeUndefined();
      expect(
        await cacheService.get(FriendshipCacheKey.mutual("user_b", "user_a"), z.unknown()),
      ).toBe(true);
    });
  });

  describe("캐시 통계 모니터링 시나리오", () => {
    it("캐시 히트율을 추적할 수 있다", async () => {
      // Given
      await cacheService.set("key_1", "value_1");
      await cacheService.set("key_2", "value_2");

      // When
      await cacheService.get("key_1", z.unknown()); // hit
      await cacheService.get("key_2", z.unknown()); // hit
      await cacheService.get("key_1", z.unknown()); // hit
      await cacheService.get("key_2", z.unknown()); // hit
      await cacheService.get("key_1", z.unknown()); // hit
      await cacheService.get("non_existent_1", z.unknown()); // miss
      await cacheService.get("non_existent_2", z.unknown()); // miss

      // Then
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(5);
      expect(stats.misses).toBe(2);
      expect(stats.keys).toBe(2);

      const hitRate = (stats.hits / (stats.hits + stats.misses)) * 100;
      expect(hitRate).toBeCloseTo(71.43, 1);
    });

    it("리셋 후 통계가 초기화된다", async () => {
      // Given
      await cacheService.set("key_1", "value_1");
      await cacheService.get("key_1", z.unknown());
      await cacheService.get("miss", z.unknown());

      const statsBefore = cacheService.getStats();
      expect(statsBefore.hits).toBeGreaterThan(0);
      expect(statsBefore.misses).toBeGreaterThan(0);

      // When
      await cacheService.reset();

      // Then
      const statsAfter = cacheService.getStats();
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
      expect(statsAfter.keys).toBe(0);
    });
  });

  describe("캐시 키 충돌 방지 시나리오", () => {
    it("서로 다른 도메인의 캐시가 충돌하지 않는다", async () => {
      // Given
      const id = "same_id_123";

      const session = { userId: id, expiresAt: new Date(), revokedAt: null };
      const profile = createMockUserProfile({
        id,
        email: "test@test.com",
        name: "Test",
        userTag: "test#123",
      });
      const subscription = { status: "ACTIVE" as const };

      // When
      await cacheService.set(IdentityCacheKey.session(id), session, IDENTITY_CACHE_TTL_MS.SESSION);
      await cacheService.set(
        IdentityCacheKey.userProfile(id),
        profile,
        IDENTITY_CACHE_TTL_MS.USER_PROFILE,
      );
      await cacheService.set(
        EntitlementCacheKey.subscription(id),
        subscription,
        ENTITLEMENT_CACHE_TTL_MS,
      );

      // Then
      expect(await cacheService.get(IdentityCacheKey.session(id), z.unknown())).toEqual(session);
      expect(await cacheService.get(IdentityCacheKey.userProfile(id), z.unknown())).toEqual(
        profile,
      );
      expect(await cacheService.get(EntitlementCacheKey.subscription(id), z.unknown())).toEqual(
        subscription,
      );

      // When
      await cacheService.del(IdentityCacheKey.userProfile(id));

      // Then
      expect(await cacheService.get(IdentityCacheKey.session(id), z.unknown())).toEqual(session);
      expect(await cacheService.get(IdentityCacheKey.userProfile(id), z.unknown())).toBeUndefined();
      expect(await cacheService.get(EntitlementCacheKey.subscription(id), z.unknown())).toEqual(
        subscription,
      );
    });

    it("캐시 키가 설계대로 생성된다", async () => {
      // Given
      const userId = "user_key_test";
      const targetId = "target_key_test";

      // When
      const sessionKey = IdentityCacheKey.session("sess_123");
      const userProfileKey = IdentityCacheKey.userProfile(userId);
      const subscriptionKey = EntitlementCacheKey.subscription(userId);
      const mutualKey = FriendshipCacheKey.mutual(userId, targetId);

      // Then
      expect(sessionKey).toBe("aido:v1:auth:session:sess_123");
      expect(userProfileKey).toBe(`aido:v1:auth:user-profile:${userId}`);
      expect(subscriptionKey).toBe(`aido:v1:subscription:status:v2:${userId}`);
      expect(mutualKey).toBe(`aido:v1:follow:mutual:${userId}:${targetId}`);
    });
  });

  describe("LRU 캐시 퇴출 시나리오", () => {
    it("최대 항목 수 초과 시 가장 오래된 항목이 퇴출된다", async () => {
      // Given
      const smallCacheModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              registerAs(cacheConfig.namespace, () =>
                cacheConfig.parse({
                  CACHE_TYPE: "memory",
                  CACHE_DEFAULT_TTL_MS: 60_000,
                  CACHE_MAX_ITEMS: 5,
                }),
              ),
            ],
          }),
          CacheModule.forRoot(),
        ],
      }).compile();

      const smallCacheApp = smallCacheModule.createNestApplication();
      await smallCacheApp.init();
      const smallCache = smallCacheModule.get(CacheStorePort);

      try {
        // When
        for (let i = 1; i <= 5; i++) {
          await smallCache.set(`key_${i}`, `value_${i}`);
        }

        // Then
        expect(smallCache.getStats().keys).toBe(5);
        expect(await smallCache.get("key_1", z.unknown())).toBe("value_1");

        // When
        // 방금 읽은 key_1 대신 가장 오래 쓰지 않은 key_2 퇴출
        await smallCache.set("key_6", "value_6");

        // Then
        expect(smallCache.getStats().keys).toBe(5);
        expect(await smallCache.get("key_2", z.unknown())).toBeUndefined();
        expect(await smallCache.get("key_1", z.unknown())).toBe("value_1");
        expect(await smallCache.get("key_6", z.unknown())).toBe("value_6");
      } finally {
        await smallCacheApp.close();
      }
    });
  });
});
