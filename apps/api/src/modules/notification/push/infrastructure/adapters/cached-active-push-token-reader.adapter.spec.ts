import { z } from "zod";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";

import {
  NOTIFICATION_CACHE_TTL_MS,
  NotificationCacheKey,
} from "../../../inbox/infrastructure/cache/notification-cache.keyspace.js";
import { CachedActivePushTokenReaderAdapter } from "./cached-active-push-token-reader.adapter.js";

const TOKENS_SCHEMA = z.array(z.string());

function createFixture(tokens: Parameters<typeof createPushTokenFixture>[0][] = []) {
  const cache = new CacheService(new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }));
  const pushTokenRepository = new InMemoryPushTokenRepository(
    tokens.map((overrides, index) => createPushTokenFixture({ id: index + 1, ...overrides })),
  );
  const reader = new CachedActivePushTokenReaderAdapter(pushTokenRepository, cache);
  return { cache, pushTokenRepository, reader };
}

describe("CachedActivePushTokenReaderAdapter - 활성 푸시 토큰 cache-aside", () => {
  it("단건 캐시 미스는 활성 토큰만 최근 갱신순으로 읽어 토큰 TTL로 캐시한다", async () => {
    // Given
    const userId = "user-single";
    const { cache, reader } = createFixture([
      {
        userId,
        deviceId: "ios_device-old",
        token: "ExponentPushToken[second]",
        updatedAt: Temporal.Instant.from("2026-11-09T00:00:00Z"),
      },
      {
        userId,
        deviceId: "ios_device-new",
        token: "ExponentPushToken[first]",
        updatedAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
      },
      { userId, deviceId: "ios_device-off", token: "ExponentPushToken[off]", isActive: false },
    ]);

    // When
    const result = await reader.findByUserId(userId);

    // Then
    const key = NotificationCacheKey.pushTokens(userId);
    expect(result).toEqual(["ExponentPushToken[first]", "ExponentPushToken[second]"]);
    await expect(cache.get(key, TOKENS_SCHEMA)).resolves.toEqual(result);
    expect(await cache.ttl(key)).toBeGreaterThan(NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS - 1000);
    expect(await cache.ttl(key)).toBeLessThanOrEqual(NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS);
  });

  it("단건 캐시 히트는 저장소를 조회하지 않는다", async () => {
    // Given
    const userId = "user-cached";
    const { cache, reader } = createFixture([{ userId, token: "ExponentPushToken[db]" }]);
    await cache.set(NotificationCacheKey.pushTokens(userId), ["ExponentPushToken[cached]"]);

    // When
    const result = await reader.findByUserId(userId);

    // Then
    expect(result).toEqual(["ExponentPushToken[cached]"]);
  });

  it("배치는 캐시 누락 사용자만 한 번에 조회하고 토큰이 없는 사용자도 음수 캐시한다", async () => {
    // Given
    const cachedUserId = "user-cached";
    const loadedUserId = "user-loaded";
    const tokenlessUserId = "user-tokenless";
    const { cache, pushTokenRepository, reader } = createFixture([
      { userId: cachedUserId, deviceId: "ios_device-c", token: "ExponentPushToken[db-only]" },
      {
        userId: loadedUserId,
        deviceId: "ios_device-1",
        token: "ExponentPushToken[loaded-first]",
      },
      {
        userId: loadedUserId,
        deviceId: "ios_device-2",
        token: "ExponentPushToken[loaded-second]",
      },
    ]);
    await cache.set(NotificationCacheKey.pushTokens(cachedUserId), ["ExponentPushToken[cached]"]);
    const findActive = vi.spyOn(pushTokenRepository, "findActivePushTokensByUsers");

    // When
    const result = await reader.findByUserIds([cachedUserId, loadedUserId, tokenlessUserId]);

    // Then
    expect(findActive).toHaveBeenCalledExactlyOnceWith([loadedUserId, tokenlessUserId]);
    expect([...result]).toEqual([
      [cachedUserId, ["ExponentPushToken[cached]"]],
      [loadedUserId, ["ExponentPushToken[loaded-first]", "ExponentPushToken[loaded-second]"]],
    ]);
    expect(result.has(tokenlessUserId)).toBe(false);
    const missedKeys = [loadedUserId, tokenlessUserId].map((userId) =>
      NotificationCacheKey.pushTokens(userId),
    );
    await expect(cache.mget(missedKeys, TOKENS_SCHEMA)).resolves.toEqual([
      ["ExponentPushToken[loaded-first]", "ExponentPushToken[loaded-second]"],
      [],
    ]);
    for (const key of missedKeys) {
      expect(await cache.ttl(key)).toBeGreaterThan(NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS - 1000);
    }
  });

  it("배치 캐시 히트는 빈 토큰 배열을 유지하면서 저장소와 캐시 쓰기를 생략한다", async () => {
    // Given
    const { cache, pushTokenRepository, reader } = createFixture([
      { userId: "user-without-token", token: "ExponentPushToken[db-only]" },
    ]);
    await cache.set(NotificationCacheKey.pushTokens("user-with-token"), [
      "ExponentPushToken[cached]",
    ]);
    await cache.set(NotificationCacheKey.pushTokens("user-without-token"), []);
    const findActive = vi.spyOn(pushTokenRepository, "findActivePushTokensByUsers");
    const mset = vi.spyOn(cache, "mset");

    // When
    const result = await reader.findByUserIds(["user-with-token", "user-without-token"]);

    // Then
    expect([...result]).toEqual([["user-with-token", ["ExponentPushToken[cached]"]]]);
    expect(findActive).not.toHaveBeenCalled();
    expect(mset).not.toHaveBeenCalled();
  });

  it("빈 배치 입력은 캐시와 저장소를 조회하지 않는다", async () => {
    // Given
    const { cache, pushTokenRepository, reader } = createFixture();
    const mget = vi.spyOn(cache, "mget");
    const findActive = vi.spyOn(pushTokenRepository, "findActivePushTokensByUsers");

    // When
    const result = await reader.findByUserIds([]);

    // Then
    expect(result.size).toBe(0);
    expect(mget).not.toHaveBeenCalled();
    expect(findActive).not.toHaveBeenCalled();
  });
});
