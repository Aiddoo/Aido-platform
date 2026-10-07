import { TestBed } from "@suites/unit";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { CacheService } from "./cache.service.js";
import { CACHE_SERVICE, type ICacheService, type TtlValue } from "./interfaces/cache.interface.js";
import { cacheKey } from "./keyspace/cache-key.js";

describe("CacheService — 캐시 서비스", () => {
  let service: CacheService;
  let mockCacheAdapter: Mocked<ICacheService>;

  beforeEach(async () => {
    const mockCacheAdapterImpl = mock<ICacheService>();

    // Suites가 모든 의존성을 자동으로 mock (CACHE_SERVICE는 impl()로 수동 설정)
    const { unit } = await TestBed.solitary(CacheService)
      .mock(CACHE_SERVICE)
      .impl(() => mockCacheAdapterImpl)
      .compile();

    service = unit;
    mockCacheAdapter = mockCacheAdapterImpl;
  });

  describe("제네릭 메서드", () => {
    it("get 호출을 어댑터에 위임한다", async () => {
      // Given
      const key = "key";
      const expectedValue = "value";
      mockCacheAdapter.get.mockResolvedValue(expectedValue);

      // When
      const result = await service.get(key);

      // Then
      expect(mockCacheAdapter.get).toHaveBeenCalledWith(key);
      expect(result).toBe(expectedValue);
    });

    it("set 호출을 어댑터에 위임한다", async () => {
      // Given
      const key = "key";
      const value = "value";
      const ttlMs = 5000;

      // When
      await service.set(key, value, ttlMs);

      // Then
      expect(mockCacheAdapter.set).toHaveBeenCalledWith(key, value, ttlMs);
    });

    it("del 호출을 어댑터에 위임한다", async () => {
      // Given
      const key = "key";

      // When
      await service.del(key);

      // Then
      expect(mockCacheAdapter.del).toHaveBeenCalledWith(key);
    });

    it("delByPattern 호출을 어댑터에 위임한다", async () => {
      // Given
      const pattern = "user:*";
      const deletedCount = 5;
      mockCacheAdapter.delByPattern.mockResolvedValue(deletedCount);

      // When
      const result = await service.delByPattern(pattern);

      // Then
      expect(mockCacheAdapter.delByPattern).toHaveBeenCalledWith(pattern);
      expect(result).toBe(deletedCount);
    });

    it("reset 호출을 어댑터에 위임한다", async () => {
      // Given
      // - 어댑터가 준비됨

      // When
      await service.reset();

      // Then
      expect(mockCacheAdapter.reset).toHaveBeenCalled();
    });

    it("getStats 호출을 어댑터에 위임한다", () => {
      // Given
      const mockStats = { hits: 10, misses: 5, keys: 100, memoryUsage: 1024 };
      mockCacheAdapter.getStats.mockReturnValue(mockStats);

      // When
      const result = service.getStats();

      // Then
      expect(mockCacheAdapter.getStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it("wrap 호출을 어댑터에 위임한다", async () => {
      // Given
      const key = "key";
      const factory = vi.fn().mockResolvedValue("value");
      const ttl: TtlValue = "5m";
      mockCacheAdapter.wrap.mockResolvedValue("value");

      // When
      const result = await service.wrap(key, factory, ttl);

      // Then
      expect(mockCacheAdapter.wrap).toHaveBeenCalledWith(key, factory, ttl);
      expect(result).toBe("value");
    });

    it("mget 호출을 어댑터에 위임한다", async () => {
      // Given
      const keys = ["key1", "key2", "key3"];
      const expectedValues = ["value1", undefined, "value3"];
      mockCacheAdapter.mget.mockResolvedValue(expectedValues);

      // When
      const result = await service.mget(keys);

      // Then
      expect(mockCacheAdapter.mget).toHaveBeenCalledWith(keys);
      expect(result).toEqual(expectedValues);
    });

    it("mset 호출을 어댑터에 위임한다", async () => {
      // Given
      const entries: Array<{ key: string; value: string; ttl: TtlValue }> = [
        { key: "key1", value: "value1", ttl: 1000 },
        { key: "key2", value: "value2", ttl: "5m" },
      ];

      // When
      await service.mset(entries);

      // Then
      expect(mockCacheAdapter.mset).toHaveBeenCalledWith(entries);
    });

    it("has 호출을 어댑터에 위임한다", async () => {
      // Given
      const key = "key";
      mockCacheAdapter.has.mockResolvedValue(true);

      // When
      const result = await service.has(key);

      // Then
      expect(mockCacheAdapter.has).toHaveBeenCalledWith(key);
      expect(result).toBe(true);
    });

    it("ttl 호출을 어댑터에 위임한다", async () => {
      // Given
      const key = "key";
      mockCacheAdapter.ttl.mockResolvedValue(5000);

      // When
      const result = await service.ttl(key);

      // Then
      expect(mockCacheAdapter.ttl).toHaveBeenCalledWith(key);
      expect(result).toBe(5000);
    });

    it("touch 호출을 어댑터에 위임한다", async () => {
      // Given
      const key = "key";
      const ttl: TtlValue = "10m";
      mockCacheAdapter.touch.mockResolvedValue(true);

      // When
      const result = await service.touch(key, ttl);

      // Then
      expect(mockCacheAdapter.touch).toHaveBeenCalledWith(key, ttl);
      expect(result).toBe(true);
    });
  });

  describe("엣지 케이스", () => {
    it("동시 작업을 처리한다", async () => {
      // Given
      mockCacheAdapter.get.mockResolvedValue("value");
      mockCacheAdapter.set.mockResolvedValue(undefined);

      // When
      const operations = [
        service.get("key1"),
        service.set("key2", "value"),
        service.get("key3"),
        service.del("key4"),
      ];
      await Promise.all(operations);

      // Then
      expect(mockCacheAdapter.get).toHaveBeenCalledTimes(2);
      expect(mockCacheAdapter.set).toHaveBeenCalledTimes(1);
      expect(mockCacheAdapter.del).toHaveBeenCalledTimes(1);
    });

    it("특수 문자가 포함된 사용자 ID를 처리한다", async () => {
      // Given
      const specialUserId = "user_with-special.chars@domain.com";

      // When
      await service.get(cacheKey("test", "value", specialUserId));

      // Then
      expect(mockCacheAdapter.get).toHaveBeenCalledWith(cacheKey("test", "value", specialUserId));
    });
  });
});
