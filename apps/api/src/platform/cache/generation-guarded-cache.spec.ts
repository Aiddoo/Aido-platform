import { vi } from "vitest";
import { z } from "zod";

import { InMemoryCacheStore } from "./adapters/in-memory-cache.store.js";
import { GenerationGuardedCache } from "./generation-guarded-cache.js";

const KEY = { valueKey: "test:value:user-1", generationKey: "test:generation:user-1" };
const TTL_MS = 60_000;

// 지정한 키를 저장하기 직전에 다른 작업을 끼워 세대 확인과 저장 사이의 무효화를 재현한다
class InterleavingCacheStore extends InMemoryCacheStore {
  #beforeSet: { readonly key: string; readonly run: () => Promise<void> } | null = null;

  interleaveBeforeSet(key: string, run: () => Promise<void>): void {
    this.#beforeSet = { key, run };
  }

  override async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const pending = this.#beforeSet;
    if (pending != null && pending.key === key) {
      this.#beforeSet = null;
      await pending.run();
    }
    await super.set(key, value, ttlMs);
  }
}

function setUp() {
  const store = new InterleavingCacheStore({ defaultTtlMs: TTL_MS, maxItems: 100 });
  const cache = new GenerationGuardedCache(store, TTL_MS);
  return { store, cache };
}

describe("GenerationGuardedCache — 커밋 전에 읽은 값의 재저장 막기", () => {
  it("무효화가 없으면 factory 값을 저장해 다음 읽기는 factory를 부르지 않는다", async () => {
    // Given
    const { cache } = setUp();
    await cache.wrap({ key: KEY, schema: z.string(), factory: async () => "first", ttlMs: TTL_MS });

    // When
    const second = await cache.wrap({
      key: KEY,
      schema: z.string(),
      factory: async () => "second",
      ttlMs: TTL_MS,
    });

    // Then
    expect(second).toBe("first");
  });

  it("factory가 읽은 뒤 쓰기의 커밋 후 무효화가 오면 읽은 값은 돌려주되 저장하지 않는다", async () => {
    // Given
    // factory가 커밋 전 값을 읽는 동안 쓰기가 커밋하고 무효화한다

    const { store, cache } = setUp();
    const readBeforeCommit = async () => {
      await cache.invalidate(KEY);
      return "stale";
    };

    // When
    const returned = await cache.wrap({
      key: KEY,
      schema: z.string(),
      factory: readBeforeCommit,
      ttlMs: TTL_MS,
    });
    const next = await cache.wrap({
      key: KEY,
      schema: z.string(),
      factory: async () => "fresh",
      ttlMs: TTL_MS,
    });

    // Then
    expect(returned).toBe("stale");
    expect(next).toBe("fresh");
    expect(await store.get(KEY.valueKey, z.string())).toBe("fresh");
  });

  it("세대 확인과 저장 사이에 무효화가 끼어도 낡은 값을 남기지 않는다", async () => {
    // Given
    const { store, cache } = setUp();
    store.interleaveBeforeSet(KEY.valueKey, () => cache.invalidate(KEY));

    // When
    await cache.wrap({ key: KEY, schema: z.string(), factory: async () => "stale", ttlMs: TTL_MS });

    // Then
    expect(await store.get(KEY.valueKey, z.string())).toBeUndefined();
  });

  it("factory가 값이 없다고 하면 저장하지 않는다", async () => {
    // Given
    const { store, cache } = setUp();

    // When
    const result = await cache.wrap({
      key: KEY,
      schema: z.string().optional(),
      factory: async () => undefined,
      ttlMs: TTL_MS,
    });

    // Then
    expect(result).toBeUndefined();
    expect(await store.has(KEY.valueKey)).toBe(false);
  });

  it("같은 세대의 동시 미스 둘은 factory를 한 번만 부르고 같은 값을 받는다", async () => {
    // Given
    const { cache } = setUp();
    let factoryCalls = 0;
    const factory = async () => {
      factoryCalls += 1;
      await Promise.resolve();
      return `value-${factoryCalls}`;
    };

    // When
    const results = await Promise.all([
      cache.wrap({ key: KEY, schema: z.string(), factory, ttlMs: TTL_MS }),
      cache.wrap({ key: KEY, schema: z.string(), factory, ttlMs: TTL_MS }),
    ]);

    // Then
    expect(factoryCalls).toBe(1);
    expect(results).toEqual(["value-1", "value-1"]);
  });

  it("무효화 뒤에 온 미스는 커밋 전에 시작한 factory를 기다리지 않고 새로 읽는다", async () => {
    // Given
    const { store, cache } = setUp();
    let staleFactoryStarted = false;
    let releaseStale: () => void = () => {};
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = resolve;
    });
    const staleRead = cache.wrap({
      key: KEY,
      schema: z.string(),
      factory: async () => {
        staleFactoryStarted = true;
        await staleGate;
        return "stale";
      },
      ttlMs: TTL_MS,
    });
    await vi.waitFor(() => expect(staleFactoryStarted).toBe(true));
    await cache.invalidate(KEY);

    // When
    const freshRead = await cache.wrap({
      key: KEY,
      schema: z.string(),
      factory: async () => "fresh",
      ttlMs: TTL_MS,
    });
    releaseStale();

    // Then
    expect(freshRead).toBe("fresh");
    expect(await staleRead).toBe("stale");
    expect(await store.get(KEY.valueKey, z.string())).toBe("fresh");
  });
});
