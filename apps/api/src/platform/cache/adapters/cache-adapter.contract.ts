import { z } from "zod";

import type { ICacheService } from "../interfaces/cache.interface.js";

/**
 * ICacheService 계약 공유 테스트
 *
 * 모든 캐시 어댑터(in-memory, Redis, 향후 다른 백엔드)가 동일하게
 * 통과해야 하는 behavioral spec. 어댑터 교체 가능성의 증명이며,
 * 새 어댑터를 만들면 이 함수를 spec에서 호출해 계약 준수를 검증한다.
 *
 * @example
 * describeCacheAdapterContract({
 *   createAdapter: () => new MyCacheAdapter(...),
 *   cleanup: (adapter) => adapter.reset(),
 * });
 */
export function describeCacheAdapterContract(context: {
  createAdapter: () => ICacheService;
  cleanup?: (adapter: ICacheService) => Promise<void> | void;
}): void {
  describe("ICacheService 계약", () => {
    let cache: ICacheService;

    beforeEach(() => {
      cache = context.createAdapter();
    });

    afterEach(async () => {
      await context.cleanup?.(cache);
    });

    it("set한 값을 get으로 조회할 수 있다", async () => {
      // Given
      const value = { foo: "bar", count: 3 };

      // When
      await cache.set("contract:key", value);
      const result = await cache.get("contract:key", z.unknown());

      // Then
      expect(result).toEqual(value);
    });

    it("스키마와 다른 값은 캐시 미스로 취급한다", async () => {
      // Given - 이전 배포가 다른 모양으로 남긴 값
      await cache.set("contract:key", { count: "3" });

      // When
      const result = await cache.get("contract:key", z.object({ count: z.number() }));

      // Then
      expect(result).toBeUndefined();
    });

    it("JSON 문자열이 된 날짜는 스키마로 Date를 복원한다", async () => {
      // Given
      const savedAt = new Date("2026-10-26T00:00:00.000Z");
      await cache.set("contract:key", { savedAt });

      // When
      const result = await cache.get("contract:key", z.object({ savedAt: z.coerce.date() }));

      // Then
      expect(result).toEqual({ savedAt });
    });

    it("존재하지 않는 키는 undefined를 반환한다", async () => {
      // When
      const result = await cache.get("contract:missing", z.unknown());

      // Then
      expect(result).toBeUndefined();
    });

    it("del한 키는 조회되지 않는다", async () => {
      // Given
      await cache.set("contract:key", "value");

      // When
      await cache.del("contract:key");

      // Then
      expect(await cache.get("contract:key", z.unknown())).toBeUndefined();
    });

    it("has는 키 존재 여부를 반환한다", async () => {
      // Given
      await cache.set("contract:key", "value");

      // Then
      expect(await cache.has("contract:key")).toBe(true);
      expect(await cache.has("contract:missing")).toBe(false);
    });

    it("존재하지 않는 키의 ttl은 -2를 반환한다", async () => {
      // When
      const result = await cache.ttl("contract:missing");

      // Then
      expect(result).toBe(-2);
    });

    it("touch는 존재하지 않는 키에 false를 반환한다", async () => {
      // When
      const result = await cache.touch("contract:missing", 1000);

      // Then
      expect(result).toBe(false);
    });

    it("touch는 존재하는 키의 TTL을 갱신하고 true를 반환한다", async () => {
      // Given
      await cache.set("contract:key", "value", 1000);

      // When
      const result = await cache.touch("contract:key", 60_000);

      // Then
      expect(result).toBe(true);
    });

    it("mset한 값들을 mget으로 조회하고, 없는 키는 undefined로 채운다", async () => {
      // Given
      await cache.mset([
        { key: "contract:a", value: 1 },
        { key: "contract:b", value: 2 },
      ]);

      // When
      const result = await cache.mget(
        ["contract:a", "contract:missing", "contract:b"],
        z.unknown(),
      );

      // Then
      expect(result).toEqual([1, undefined, 2]);
    });

    it("wrap은 캐시 미스 시 factory를 실행하고 결과를 캐싱한다", async () => {
      // Given
      const factory = vi.fn().mockResolvedValue("fresh");

      // When
      const first = await cache.wrap("contract:wrap", z.unknown(), factory);
      const second = await cache.wrap("contract:wrap", z.unknown(), factory);

      // Then
      expect(first).toBe("fresh");
      expect(second).toBe("fresh");
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("delByPattern은 패턴에 매칭되는 키를 삭제하고 개수를 반환한다", async () => {
      // Given
      await cache.set("contract:user:1", "a");
      await cache.set("contract:user:2", "b");
      await cache.set("contract:other", "c");

      // When
      const deleted = await cache.delByPattern("contract:user:*");

      // Then
      expect(deleted).toBe(2);
      expect(await cache.get("contract:user:1", z.unknown())).toBeUndefined();
      expect(await cache.get("contract:other", z.unknown())).toBe("c");
    });
  });
}
