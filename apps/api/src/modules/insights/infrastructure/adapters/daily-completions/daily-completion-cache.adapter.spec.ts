import { vi } from "vitest";

import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";

import type { DailyCompletionsRange } from "../../../domain/records/daily-completions/daily-completion.record.js";
import {
  DAILY_COMPLETION_CACHE_TTL_MS,
  DAILY_COMPLETION_GENERATION_TTL_MS,
  DailyCompletionCacheKey,
} from "../../cache/daily-completions/daily-completion-cache.keyspace.js";
import { DailyCompletionCacheAdapter } from "./daily-completion-cache.adapter.js";

const USER_ID = "owner-1";
const START_DATE = "2028-02-29";
const END_DATE = "2028-03-01";
const RANGE: DailyCompletionsRange = {
  completions: [],
  totalCompleteDays: 0,
  dateRange: { startDate: START_DATE, endDate: END_DATE },
};

describe("DailyCompletionCacheAdapter — 완료 집계 generation", () => {
  let backend: InMemoryCacheAdapter;
  let cacheService: CacheService;
  let adapter: DailyCompletionCacheAdapter;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2028-02-29T12:00:00Z"));
    backend = new InMemoryCacheAdapter({ defaultTtlMs: 60_000, maxItems: 100 });
    cacheService = new CacheService(backend);
    adapter = new DailyCompletionCacheAdapter(cacheService);
  });

  afterEach(() => {
    backend.onModuleDestroy();
    vi.useRealTimers();
  });

  it("같은 세대의 본인·공개 집계를 분리해 저장하고 기존 TTL을 유지한다", async () => {
    // Given
    const ownRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);
    const publicRead = await adapter.readPublicRange(USER_ID, START_DATE, END_DATE);
    const publicRange = { ...RANGE, totalCompleteDays: 1 };

    // When
    await adapter.storeRangeIfCurrent(USER_ID, START_DATE, END_DATE, ownRead.generation, RANGE);
    await adapter.storePublicRangeIfCurrent(
      USER_ID,
      START_DATE,
      END_DATE,
      publicRead.generation,
      publicRange,
    );

    // Then
    expect(publicRead.generation).toBe(ownRead.generation);
    await expect(adapter.readRange(USER_ID, START_DATE, END_DATE)).resolves.toEqual({
      generation: ownRead.generation,
      value: RANGE,
    });
    await expect(adapter.readPublicRange(USER_ID, START_DATE, END_DATE)).resolves.toEqual({
      generation: ownRead.generation,
      value: publicRange,
    });
    expect(
      await backend.ttl(
        DailyCompletionCacheKey.range(USER_ID, ownRead.generation, START_DATE, END_DATE),
      ),
    ).toBe(DAILY_COMPLETION_CACHE_TTL_MS);
    expect(await backend.ttl(DailyCompletionCacheKey.generation(USER_ID))).toBe(
      DAILY_COMPLETION_GENERATION_TTL_MS,
    );
  });

  it("DB 조회 중 무효화되면 늦게 완료한 이전 결과를 현재 캐시에 저장하지 않는다", async () => {
    // Given
    const staleRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);

    // When
    await adapter.invalidate(USER_ID);
    await adapter.storeRangeIfCurrent(USER_ID, START_DATE, END_DATE, staleRead.generation, RANGE);

    // Then
    const currentRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);
    expect(currentRead.generation).not.toBe(staleRead.generation);
    expect(currentRead.value).toBeUndefined();
    expect(
      await backend.has(
        DailyCompletionCacheKey.range(USER_ID, staleRead.generation, START_DATE, END_DATE),
      ),
    ).toBe(false);
  });

  it("값을 읽는 동안 무효화되면 이전 캐시 hit도 반환하지 않는다", async () => {
    // Given
    const initialRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);
    await adapter.storeRangeIfCurrent(USER_ID, START_DATE, END_DATE, initialRead.generation, RANGE);
    const valueKey = DailyCompletionCacheKey.range(
      USER_ID,
      initialRead.generation,
      START_DATE,
      END_DATE,
    );
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const originalGet = cacheService.get.bind(cacheService);
    vi.spyOn(cacheService, "get").mockImplementation(async (key) => {
      const value = await originalGet(key);
      if (key === valueKey) {
        entered.resolve();
        await release.promise;
      }
      return value;
    });
    const reading = adapter.readRange(USER_ID, START_DATE, END_DATE);

    // When
    try {
      await Promise.race([entered.promise, reading]);
      await adapter.invalidate(USER_ID);
    } finally {
      release.resolve();
    }
    const result = await reading;

    // Then
    expect(result.generation).not.toBe(initialRead.generation);
    expect(result.value).toBeUndefined();
  });

  it("이전 배포의 v1 prefix 무효화도 새 세대를 단절하고 v1 값은 읽지 않는다", async () => {
    // Given
    const initialRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);
    await adapter.storePublicRangeIfCurrent(
      USER_ID,
      START_DATE,
      END_DATE,
      initialRead.generation,
      RANGE,
    );
    const legacyKey = `aido:v1:daily-completion:range-v1:${USER_ID}:${START_DATE}:${END_DATE}`;
    await backend.set(legacyKey, RANGE);

    // When - 이전 서버의 기존 invalidator와 동일한 prefix 삭제
    await backend.delByPattern(DailyCompletionCacheKey.legacyPattern(USER_ID));
    await backend.set(legacyKey, RANGE);
    const currentRead = await adapter.readPublicRange(USER_ID, START_DATE, END_DATE);
    const ownRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);

    // Then
    expect(currentRead.generation).not.toBe(initialRead.generation);
    expect(currentRead.value).toBeUndefined();
    expect(ownRead.value).toBeUndefined();
  });

  it("세대 키만 삭제되어도 남은 이전 namespace가 다시 활성화되지 않는다", async () => {
    // Given
    const initialRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);
    await adapter.storeRangeIfCurrent(USER_ID, START_DATE, END_DATE, initialRead.generation, RANGE);

    // When - 캐시 eviction으로 generation만 유실된 상태
    await backend.del(DailyCompletionCacheKey.generation(USER_ID));
    const currentRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);

    // Then
    expect(currentRead.generation).not.toBe(initialRead.generation);
    expect(currentRead.value).toBeUndefined();
    expect(
      await backend.has(
        DailyCompletionCacheKey.range(USER_ID, initialRead.generation, START_DATE, END_DATE),
      ),
    ).toBe(true);
  });

  it("저장 검사 직후 무효화되어도 이전 namespace의 값은 새 조회에 노출하지 않는다", async () => {
    // Given
    const initialRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);
    const valueKey = DailyCompletionCacheKey.range(
      USER_ID,
      initialRead.generation,
      START_DATE,
      END_DATE,
    );
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const originalSet = cacheService.set.bind(cacheService);
    vi.spyOn(cacheService, "set").mockImplementation(async (key, value, ttl) => {
      if (key === valueKey) {
        entered.resolve();
        await release.promise;
      }
      await originalSet(key, value, ttl);
    });
    const storing = adapter.storeRangeIfCurrent(
      USER_ID,
      START_DATE,
      END_DATE,
      initialRead.generation,
      RANGE,
    );

    // When
    try {
      await Promise.race([entered.promise, storing]);
      await adapter.invalidate(USER_ID);
    } finally {
      release.resolve();
    }
    await storing;

    // Then
    expect(await backend.has(valueKey)).toBe(true);
    const currentRead = await adapter.readRange(USER_ID, START_DATE, END_DATE);
    expect(currentRead.generation).not.toBe(initialRead.generation);
    expect(currentRead.value).toBeUndefined();
  });
});
