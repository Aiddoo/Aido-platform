/**
 * RedisCacheAdapter 단위 테스트
 *
 * @description
 * - ICacheService 계약 준수 (ioredis-mock — in-memory 어댑터와 동일 계약)
 * - Redis 장애 시 fail-open: 읽기는 미스 취급, 쓰기는 조용히 무시
 * - 로그 샘플러: 장애 중 로그 폭발 방지
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test redis-cache.adapter
 * ```
 */
import RedisMock from "ioredis-mock";
import { vi, type Mock } from "vitest";

import { RedisErrorLogSampler } from "../../redis/redis-error-log-sampler.js";
import { describeCacheAdapterContract } from "./cache-adapter.contract.js";
import { RedisCacheAdapter } from "./redis-cache.adapter.js";

describe("RedisCacheAdapter — Redis 캐시 어댑터", () => {
  let contractRedis: InstanceType<typeof RedisMock>;

  describeCacheAdapterContract({
    createAdapter: () => {
      contractRedis = new RedisMock();
      return new RedisCacheAdapter(contractRedis, 60_000);
    },
    cleanup: async (adapter) => {
      try {
        await adapter.reset();
      } finally {
        contractRedis.disconnect();
      }
    },
  });

  describe("fail-open (Redis 장애 시)", () => {
    const failure = new Error("Connection is closed.");
    let redis: InstanceType<typeof RedisMock>;
    let warn: Mock;
    let cache: RedisCacheAdapter;

    beforeEach(() => {
      redis = new RedisMock();
      warn = vi.fn();
      cache = new RedisCacheAdapter(redis, 60_000, new RedisErrorLogSampler({ warn }));
    });

    afterEach(() => {
      redis.disconnect();
    });

    it("get 실패 시 캐시 미스(undefined)로 취급한다", async () => {
      // Given
      vi.spyOn(redis, "get").mockRejectedValue(failure);

      // When
      const result = await cache.get("key");

      // Then
      expect(result).toBeUndefined();
    });

    it("mget 실패 시 전원 undefined를 반환한다", async () => {
      // Given
      vi.spyOn(redis, "mget").mockRejectedValue(failure);

      // When
      const result = await cache.mget(["a", "b", "c"]);

      // Then
      expect(result).toEqual([undefined, undefined, undefined]);
    });

    it("has 실패 시 false를 반환한다", async () => {
      // Given
      vi.spyOn(redis, "exists").mockRejectedValue(failure);

      // When / Then
      expect(await cache.has("key")).toBe(false);
    });

    it("ttl 실패 시 -2(키 없음)를 반환한다", async () => {
      // Given
      vi.spyOn(redis, "pttl").mockRejectedValue(failure);

      // When / Then
      expect(await cache.ttl("key")).toBe(-2);
    });

    it("touch 실패 시 false를 반환한다", async () => {
      // Given
      vi.spyOn(redis, "pexpire").mockRejectedValue(failure);

      // When / Then
      expect(await cache.touch("key", 1000)).toBe(false);
    });

    it("set/del/mset 실패는 조용히 무시한다 (throw하지 않음)", async () => {
      // Given
      vi.spyOn(redis, "set").mockRejectedValue(failure);
      vi.spyOn(redis, "del").mockRejectedValue(failure);
      vi.spyOn(redis, "pipeline").mockImplementation(() => {
        throw failure;
      });

      // When / Then
      await expect(cache.set("key", "value")).resolves.toBeUndefined();
      await expect(cache.del("key")).resolves.toBeUndefined();
      await expect(cache.mset([{ key: "a", value: 1 }])).resolves.toBeUndefined();
    });

    it("delByPattern 실패 시 지금까지 삭제한 개수를 반환한다", async () => {
      // Given
      vi.spyOn(redis, "scan").mockRejectedValue(failure);

      // When / Then
      expect(await cache.delByPattern("user:*")).toBe(0);
    });

    it("reset 실패는 조용히 무시한다", async () => {
      // Given
      vi.spyOn(redis, "scan").mockRejectedValue(failure);

      // When / Then
      await expect(cache.reset()).resolves.toBeUndefined();
    });

    it("wrap은 get 실패 시 factory 결과를 그대로 반환한다 (DB 폴백)", async () => {
      // Given
      vi.spyOn(redis, "get").mockRejectedValue(failure);
      vi.spyOn(redis, "set").mockRejectedValue(failure);
      const factory = vi.fn().mockResolvedValue("from-db");

      // When
      const result = await cache.wrap("key", factory);

      // Then
      expect(result).toBe("from-db");
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("장애 중 반복 에러는 샘플러가 억제한다 (warn 1회)", async () => {
      // Given
      vi.spyOn(redis, "get").mockRejectedValue(failure);

      // When
      for (let i = 0; i < 50; i++) {
        await cache.get("key");
      }

      // Then
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });
});
