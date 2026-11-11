import { z } from "zod";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import type { CacheValueSchema } from "#api/platform/cache/cache-store.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  calendarDate,
  createDailyCompletionFixture,
  createDailyCompletionRangeFixture,
  createDateRangeFixture,
  DAILY_COMPLETION_FIXTURE_NOW,
  DAILY_COMPLETION_FIXTURE_USER_ID,
} from "#test/fixtures/insights/daily-completion.fixture";

import { DailyCompletionCache } from "./daily-completion.cache.js";
import {
  DAILY_COMPLETION_CACHE_TTL_MS,
  DAILY_COMPLETION_GENERATION_TTL_MS,
  DailyCompletionCacheKey,
} from "./daily-completion.keyspace.js";

const USER = UserId.reconstitute(DAILY_COMPLETION_FIXTURE_USER_ID);
const START_DATE = "2028-02-29";
const END_DATE = "2028-03-01";
const RANGE = createDateRangeFixture(START_DATE, END_DATE);
const VALUE = createDailyCompletionRangeFixture({ range: RANGE, completions: [] });

// 지정한 키를 읽거나 쓰는 도중에 멈춰 무효화와 겹치는 순서를 재현한다
class GatedCacheStore extends InMemoryCacheStore {
  #gate: {
    readonly key: string;
    readonly entered: () => void;
    readonly release: Promise<void>;
  } | null = null;

  holdAt(key: string): { readonly entered: Promise<void>; readonly release: () => void } {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    this.#gate = { key, entered: entered.resolve, release: release.promise };
    return { entered: entered.promise, release: release.resolve };
  }

  override async get<T>(key: string, schema: CacheValueSchema<T>): Promise<T | undefined> {
    const value = await super.get(key, schema);
    await this.#pauseAt(key);
    return value;
  }

  override async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.#pauseAt(key);
    await super.set(key, value, ttlMs);
  }

  async #pauseAt(key: string): Promise<void> {
    const gate = this.#gate;
    if (gate == null || gate.key !== key) {
      return;
    }
    this.#gate = null;
    gate.entered();
    await gate.release;
  }
}

describe("DailyCompletionCache — 완료 집계 세대 캐시", () => {
  let backend: GatedCacheStore;
  let cache: DailyCompletionCache;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(DAILY_COMPLETION_FIXTURE_NOW.epochMilliseconds);
    backend = new GatedCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new DailyCompletionCache(backend);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("같은 세대의 본인·공개 집계를 나눠 담고 기존 TTL을 유지한다", async () => {
    // Given
    const ownRead = await cache.readRange(USER, RANGE);
    const publicRead = await cache.readPublicRange(USER, RANGE);
    const publicValue = createDailyCompletionRangeFixture({ range: RANGE });

    // When
    await cache.storeRangeIfCurrent(USER, ownRead.generation, VALUE);
    await cache.storePublicRangeIfCurrent(USER, publicRead.generation, publicValue);

    // Then
    expect(publicRead.generation).toBe(ownRead.generation);
    expect((await cache.readRange(USER, RANGE)).value?.completions).toEqual([]);
    expect((await cache.readPublicRange(USER, RANGE)).value?.totalCompleteDays).toBe(1);
    expect(
      await backend.ttl(
        DailyCompletionCacheKey.range(USER.value, ownRead.generation, START_DATE, END_DATE),
      ),
    ).toBe(DAILY_COMPLETION_CACHE_TTL_MS);
    expect(await backend.ttl(DailyCompletionCacheKey.generation(USER.value))).toBe(
      DAILY_COMPLETION_GENERATION_TTL_MS,
    );
  });

  it("배포 사이 이전·다음 버전이 같은 키를 읽도록 응답 계약과 같은 JSON으로 담는다", async () => {
    // Given
    const read = await cache.readRange(USER, RANGE);
    const value = createDailyCompletionRangeFixture({
      range: RANGE,
      completions: [
        createDailyCompletionFixture({
          date: calendarDate("2028-03-01"),
          totalTodos: 4,
          completedTodos: 3,
          categoryColors: ["#123456", "#654321"],
        }),
      ],
    });

    // When
    await cache.storeRangeIfCurrent(USER, read.generation, value);
    const stored = await backend.get(
      DailyCompletionCacheKey.range(USER.value, read.generation, START_DATE, END_DATE),
      z.unknown(),
    );

    // Then
    expect(stored).toEqual({
      completions: [
        {
          date: "2028-03-01",
          totalTodos: 4,
          completedTodos: 3,
          isComplete: false,
          completionRate: 75,
          categoryColors: ["#123456", "#654321"],
        },
      ],
      totalCompleteDays: 0,
      multiDayTodos: [],
      dateRange: { startDate: START_DATE, endDate: END_DATE },
    });
  });

  it("여러 날 할 일을 시작일에만 세던 이전 배포의 값(기간이 남은 값)은 미스로 보고 다시 센다", async () => {
    // Given
    const read = await cache.readRange(USER, RANGE);
    await backend.set(
      DailyCompletionCacheKey.range(USER.value, read.generation, START_DATE, END_DATE),
      {
        completions: [],
        totalCompleteDays: 0,
        multiDayTodos: [
          { startDate: "2028-02-28", endDate: "2028-03-01", completed: false, categoryColor: "#1" },
        ],
        dateRange: { startDate: START_DATE, endDate: END_DATE },
      },
    );

    // When
    const reread = await cache.readRange(USER, RANGE);

    // Then
    expect(reread.generation).toBe(read.generation);
    expect(reread.value).toBeNull();
  });

  it("DB 조회 중 무효화되면 늦게 끝난 이전 결과를 현재 세대에 저장하지 않는다", async () => {
    // Given
    const staleRead = await cache.readRange(USER, RANGE);

    // When
    await cache.invalidate(USER);
    await cache.storeRangeIfCurrent(USER, staleRead.generation, VALUE);

    // Then
    const currentRead = await cache.readRange(USER, RANGE);
    expect(currentRead.generation).not.toBe(staleRead.generation);
    expect(currentRead.value).toBeNull();
    expect(
      await backend.has(
        DailyCompletionCacheKey.range(USER.value, staleRead.generation, START_DATE, END_DATE),
      ),
    ).toBe(false);
  });

  it("값을 읽는 동안 무효화되면 이전 캐시 hit도 돌려주지 않는다", async () => {
    // Given
    const initialRead = await cache.readRange(USER, RANGE);
    await cache.storeRangeIfCurrent(USER, initialRead.generation, VALUE);
    const held = backend.holdAt(
      DailyCompletionCacheKey.range(USER.value, initialRead.generation, START_DATE, END_DATE),
    );
    const reading = cache.readRange(USER, RANGE);
    await held.entered;

    // When
    await cache.invalidate(USER);
    held.release();
    const result = await reading;

    // Then
    expect(result.generation).not.toBe(initialRead.generation);
    expect(result.value).toBeNull();
  });

  it("세대 키만 사라져도 남은 이전 namespace가 다시 살아나지 않는다", async () => {
    // Given
    const initialRead = await cache.readRange(USER, RANGE);
    await cache.storeRangeIfCurrent(USER, initialRead.generation, VALUE);

    // When - 캐시 eviction으로 세대 키만 사라진 상태
    await backend.del(DailyCompletionCacheKey.generation(USER.value));
    const currentRead = await cache.readRange(USER, RANGE);

    // Then
    expect(currentRead.generation).not.toBe(initialRead.generation);
    expect(currentRead.value).toBeNull();
    expect(
      await backend.has(
        DailyCompletionCacheKey.range(USER.value, initialRead.generation, START_DATE, END_DATE),
      ),
    ).toBe(true);
  });

  it("저장 검사 직후 무효화되어도 이전 namespace의 값은 새 조회에 보이지 않는다", async () => {
    // Given
    const initialRead = await cache.readRange(USER, RANGE);
    const valueKey = DailyCompletionCacheKey.range(
      USER.value,
      initialRead.generation,
      START_DATE,
      END_DATE,
    );
    const held = backend.holdAt(valueKey);
    const storing = cache.storeRangeIfCurrent(USER, initialRead.generation, VALUE);
    await held.entered;

    // When
    await cache.invalidate(USER);
    held.release();
    await storing;

    // Then
    expect(await backend.has(valueKey)).toBe(true);
    const currentRead = await cache.readRange(USER, RANGE);
    expect(currentRead.generation).not.toBe(initialRead.generation);
    expect(currentRead.value).toBeNull();
  });
});
