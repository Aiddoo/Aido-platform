import { z } from "zod";

import { describeCacheStoreContract } from "#test/contracts/platform/cache-store.contract";

import { InMemoryCacheStore } from "./in-memory-cache.store.js";

describeCacheStoreContract({
  name: "InMemoryCacheStore",
  createStore: () => new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
});

describe("InMemoryCacheStore — 크기 상한", () => {
  it("상한을 넘으면 가장 오래 쓰지 않은 항목부터 내보낸다", async () => {
    // Given
    const cache = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 2 });
    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.get("a", z.number());

    // When
    await cache.set("c", 3);

    // Then
    expect(await cache.mget(["a", "b", "c"], z.number())).toEqual([1, undefined, 3]);
    expect(cache.getStats().keys).toBe(2);
  });

  it("null을 저장하면 미스가 아니라 null을 돌려준다", async () => {
    // Given
    const cache = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 });

    // When
    await cache.set("empty", null);

    // Then
    expect(await cache.get("empty", z.null())).toBeNull();
  });
});
