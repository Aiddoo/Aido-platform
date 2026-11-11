import { vi } from "vitest";

import { describeLockProviderContract } from "#test/contracts/platform/lock-provider.contract";
import { suppressLogger } from "#test/setup/suppress-logger";

import { InMemoryLockAdapter, LOCK_MAX_ENTRIES } from "./in-memory-lock.adapter.js";

describeLockProviderContract({
  name: "InMemoryLockAdapter",
  createProvider: () => new InMemoryLockAdapter(),
});

describe("InMemoryLockAdapter — 인메모리 락 어댑터", () => {
  let lock: InMemoryLockAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    lock = new InMemoryLockAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("만료", () => {
    it("TTL이 끝나기 1ms 전까지는 잠금이 유지된다", async () => {
      // Given
      const resource = "todo:123:reminder";
      await lock.acquire(resource, 5000);

      // When
      vi.advanceTimersByTime(4999);

      // Then
      expect(await lock.isLocked(resource)).toBe(true);
      expect(await lock.acquire(resource, 5000)).toBeNull();
    });

    it("TTL이 서로 다른 잠금은 각자의 TTL이 지나면 풀린다", async () => {
      // Given
      const resource1 = "todo:1:reminder";
      const resource2 = "todo:2:reminder";
      await lock.acquire(resource1, 5000);
      await lock.acquire(resource2, 10_000);

      // When
      vi.advanceTimersByTime(30_000);

      // Then
      expect(await lock.isLocked(resource1)).toBe(false);
      expect(await lock.isLocked(resource2)).toBe(false);
    });
  });

  describe("상한", () => {
    beforeEach(() => {
      suppressLogger();
    });

    it("상한만큼 잡혀 있으면 잡힌 잠금을 내보내지 않고 새 잠금을 거부한다", async () => {
      // Given
      for (let index = 0; index < LOCK_MAX_ENTRIES; index += 1) {
        await lock.acquire(`resource:${index}`, 60_000);
      }

      // When
      const overflow = await lock.acquire("resource:overflow", 60_000);

      // Then
      expect(overflow).toBeNull();
      expect(await lock.isLocked("resource:0")).toBe(true);
      expect(await lock.acquire("resource:0", 60_000)).toBeNull();
    });

    it("상한에 닿아도 만료된 잠금을 지우고 새 잠금을 받는다", async () => {
      // Given
      for (let index = 0; index < LOCK_MAX_ENTRIES; index += 1) {
        await lock.acquire(`resource:${index}`, 1000);
      }
      vi.advanceTimersByTime(1001);

      // When
      const release = await lock.acquire("resource:after-expiry", 60_000);

      // Then
      expect(release).not.toBeNull();
    });
  });
});
