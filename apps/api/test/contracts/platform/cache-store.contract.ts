import { setTimeout as sleep } from "node:timers/promises";

import { z } from "zod";

import type { CacheStorePort } from "#api/platform/cache/cache-store.port";

/**
 * 모든 CacheStorePort 구현(in-memory, Redis, Valkey)이 통과해야 하는 계약.
 * 구현을 바꿔도 소비처가 그대로 동작한다는 증거라 새 저장소는 이 suite를 함께 돌린다.
 */
export function describeCacheStoreContract(context: {
  readonly name: string;
  readonly createStore: () => CacheStorePort | Promise<CacheStorePort>;
}): void {
  describe(`CacheStorePort 계약 — ${context.name}`, () => {
    let cache: CacheStorePort;

    beforeEach(async () => {
      cache = await context.createStore();
      await cache.reset();
    });

    it("set한 값을 get으로 읽는다", async () => {
      // Given
      const value = { foo: "bar", count: 3 };

      // When
      await cache.set("contract:key", value);

      // Then
      expect(await cache.get("contract:key", z.unknown())).toEqual(value);
    });

    it("스키마와 다른 값은 미스로 취급한다", async () => {
      // Given 이전 배포가 다른 모양으로 남긴 값
      await cache.set("contract:key", { count: "3" });

      // When
      const result = await cache.get("contract:key", z.object({ count: z.number() }));

      // Then
      expect(result).toBeUndefined();
    });

    it("날짜는 스키마의 coerce로 Date를 복원한다", async () => {
      // Given
      const savedAt = new Date("2026-10-26T00:00:00.000Z");
      await cache.set("contract:key", { savedAt });

      // When
      const result = await cache.get("contract:key", z.object({ savedAt: z.coerce.date() }));

      // Then
      expect(result).toEqual({ savedAt });
    });

    it("없는 키와 지운 키는 undefined다", async () => {
      // Given
      await cache.set("contract:key", "value");

      // When
      await cache.del("contract:key");

      // Then
      expect(await cache.get("contract:key", z.unknown())).toBeUndefined();
      expect(await cache.get("contract:missing", z.unknown())).toBeUndefined();
    });

    it("TTL이 0이면 저장하지 않는다", async () => {
      // When
      await cache.set("contract:zero", "value", 0);

      // Then
      expect(await cache.has("contract:zero")).toBe(false);
    });

    it("TTL이 지나면 값이 사라진다", async () => {
      // Given
      await cache.set("contract:short", "value", 50);

      // When & Then
      await expect
        .poll(() => cache.has("contract:short"), { timeout: 2000, interval: 25 })
        .toBe(false);
      expect(await cache.get("contract:short", z.unknown())).toBeUndefined();
    });

    it("has·ttl은 키가 있는지와 남은 밀리초를 알려 준다", async () => {
      // Given
      await cache.set("contract:key", "value", 60_000);

      // When
      const remaining = await cache.ttl("contract:key");

      // Then
      expect(await cache.has("contract:key")).toBe(true);
      expect(remaining).toBeGreaterThan(50_000);
      expect(remaining).toBeLessThanOrEqual(60_000);
      expect(await cache.has("contract:missing")).toBe(false);
      expect(await cache.ttl("contract:missing")).toBe(-2);
    });

    it("touch는 있는 키의 TTL만 바꾸고 없는 키에는 false다", async () => {
      // Given
      await cache.set("contract:key", "value", 1000);

      // When
      const touched = await cache.touch("contract:key", 60_000);

      // Then
      expect(touched).toBe(true);
      expect(await cache.ttl("contract:key")).toBeGreaterThan(1000);
      expect(await cache.get("contract:key", z.string())).toBe("value");
      expect(await cache.touch("contract:missing", 1000)).toBe(false);
    });

    it("mset한 값을 mget으로 읽고 없는 키는 undefined로 채운다", async () => {
      // Given
      await cache.mset([
        { key: "contract:a", value: 1 },
        { key: "contract:b", value: 2, ttlMs: 60_000 },
      ]);

      // When
      const result = await cache.mget(["contract:a", "contract:missing", "contract:b"], z.number());

      // Then
      expect(result).toEqual([1, undefined, 2]);
      expect(await cache.mget([], z.number())).toEqual([]);
    });

    it("wrap은 미스에서만 factory를 부르고 결과를 저장한다", async () => {
      // Given
      let calls = 0;
      const factory = async () => {
        calls++;
        return "fresh";
      };

      // When
      const first = await cache.wrap("contract:wrap", z.string(), factory);
      const second = await cache.wrap("contract:wrap", z.string(), factory);

      // Then
      expect([first, second]).toEqual(["fresh", "fresh"]);
      expect(calls).toBe(1);
    });

    it("같은 key의 동시 미스는 factory를 한 번만 부른다", async () => {
      // Given
      let calls = 0;
      const factory = async () => {
        calls++;
        await sleep(20);
        return 7;
      };

      // When
      const results = await Promise.all([
        cache.wrap("contract:flight", z.number(), factory),
        cache.wrap("contract:flight", z.number(), factory),
      ]);

      // Then
      expect(results).toEqual([7, 7]);
      expect(calls).toBe(1);
    });

    it("wrap의 TTL이 함수면 factory 결과로 보관 시간을 정한다", async () => {
      // Given 짧은 값은 1분, 긴 값은 1시간
      const ttlOf = (value: string) => (value.length < 5 ? 60_000 : 3_600_000);

      // When
      await cache.wrap("contract:wrap-ttl", z.string(), async () => "rain", ttlOf);

      // Then
      expect(await cache.ttl("contract:wrap-ttl")).toBeLessThanOrEqual(60_000);
    });

    it("delByPattern은 * 패턴과 맞는 키만 지우고 개수를 돌려준다", async () => {
      // Given * 밖의 글자(.)는 Redis glob처럼 글자 그대로 맞춘다
      await cache.set("contract:v1.0:1", "a");
      await cache.set("contract:v1.0:2", "b");
      await cache.set("contract:v1x0:3", "c");
      await cache.set("contract:other", "d");

      // When
      const deleted = await cache.delByPattern("contract:v1.0:*");

      // Then
      expect(deleted).toBe(2);
      expect(await cache.get("contract:v1.0:1", z.unknown())).toBeUndefined();
      expect(await cache.get("contract:v1x0:3", z.string())).toBe("c");
      expect(await cache.get("contract:other", z.string())).toBe("d");
    });

    it("reset은 저장한 값을 모두 지운다", async () => {
      // Given
      await cache.set("contract:a", 1);
      await cache.set("contract:b", 2);

      // When
      await cache.reset();

      // Then
      expect(await cache.mget(["contract:a", "contract:b"], z.number())).toEqual([
        undefined,
        undefined,
      ]);
    });
  });
}
