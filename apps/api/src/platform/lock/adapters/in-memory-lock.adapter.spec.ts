import { vi } from "vitest";

/**
 * InMemoryLockAdapter 단위 테스트
 *
 * @description
 * InMemoryLockAdapter의 개별 메서드를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test in-memory-lock.adapter
 * ```
 */
import { suppressLogger } from "#test/setup/suppress-logger";

import { InMemoryLockAdapter, LOCK_MAX_ENTRIES } from "./in-memory-lock.adapter.js";

describe("InMemoryLockAdapter — 인메모리 락 어댑터", () => {
  let lock: InMemoryLockAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    lock = new InMemoryLockAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("acquire", () => {
    it("잠금을 획득하면 release 함수를 반환한다", async () => {
      // Given
      const resource = "todo:123:reminder";
      const ttlMs = 5_000;

      // When
      const release = await lock.acquire(resource, ttlMs);

      // Then
      expect(release).not.toBeNull();
      expect(typeof release).toBe("function");
    });

    it("이미 잠긴 리소스에 대해 null을 반환한다", async () => {
      // Given
      const resource = "todo:123:reminder";
      await lock.acquire(resource, 5_000);

      // When
      const secondAttempt = await lock.acquire(resource, 5_000);

      // Then
      expect(secondAttempt).toBeNull();
    });

    it("release 후 동일 리소스를 재획득할 수 있다", async () => {
      // Given
      const resource = "todo:123:reminder";
      const release = await lock.acquire(resource, 5_000);
      expect(release).not.toBeNull();

      // When
      await release?.();
      const secondRelease = await lock.acquire(resource, 5_000);

      // Then
      expect(secondRelease).not.toBeNull();
      expect(typeof secondRelease).toBe("function");
    });

    it("TTL 만료 후 자동으로 잠금이 해제된다", async () => {
      // Given
      const resource = "todo:123:reminder";
      const ttlMs = 3_000;
      await lock.acquire(resource, ttlMs);

      // When
      vi.advanceTimersByTime(ttlMs);
      const release = await lock.acquire(resource, 5_000);

      // Then
      expect(release).not.toBeNull();
    });

    it("TTL이 만료되지 않은 동안에는 잠금이 유지된다", async () => {
      // Given
      const resource = "todo:123:reminder";
      const ttlMs = 5_000;
      await lock.acquire(resource, ttlMs);

      // When
      vi.advanceTimersByTime(ttlMs - 1);
      const secondAttempt = await lock.acquire(resource, 5_000);

      // Then
      expect(secondAttempt).toBeNull();
    });

    it("TTL 만료 뒤 늦게 호출한 release는 다른 소유자의 잠금을 해제하지 않는다", async () => {
      // Given
      const resource = "todo:123:reminder";
      const staleRelease = await lock.acquire(resource, 1_000);
      vi.advanceTimersByTime(1_001);
      const currentRelease = await lock.acquire(resource, 5_000);
      expect(currentRelease).not.toBeNull();

      // When
      await staleRelease?.();

      // Then
      expect(await lock.isLocked(resource)).toBe(true);
      expect(await lock.acquire(resource, 5_000)).toBeNull();
    });

    it("서로 다른 리소스는 독립적으로 잠금을 획득할 수 있다", async () => {
      // Given
      const resource1 = "todo:123:reminder";
      const resource2 = "todo:456:reminder";

      // When
      const release1 = await lock.acquire(resource1, 5_000);
      const release2 = await lock.acquire(resource2, 5_000);

      // Then
      expect(release1).not.toBeNull();
      expect(release2).not.toBeNull();
    });
  });

  describe("isLocked", () => {
    it("잠겨있는 리소스에 대해 true를 반환한다", async () => {
      // Given
      const resource = "todo:123:reminder";
      await lock.acquire(resource, 5_000);

      // When
      const result = await lock.isLocked(resource);

      // Then
      expect(result).toBe(true);
    });

    it("잠기지 않은 리소스에 대해 false를 반환한다", async () => {
      // Given
      const resource = "todo:123:reminder";

      // When
      const result = await lock.isLocked(resource);

      // Then
      expect(result).toBe(false);
    });

    it("release 후 false를 반환한다", async () => {
      // Given
      const resource = "todo:123:reminder";
      const release = await lock.acquire(resource, 5_000);
      await release?.();

      // When
      const result = await lock.isLocked(resource);

      // Then
      expect(result).toBe(false);
    });

    it("TTL 만료 후 false를 반환한다", async () => {
      // Given
      const resource = "todo:123:reminder";
      const ttlMs = 3_000;
      await lock.acquire(resource, ttlMs);

      // When
      vi.advanceTimersByTime(ttlMs);
      const result = await lock.isLocked(resource);

      // Then
      expect(result).toBe(false);
    });

    it("TTL 만료 전에는 true를 반환한다", async () => {
      // Given
      const resource = "todo:123:reminder";
      const ttlMs = 5_000;
      await lock.acquire(resource, ttlMs);

      // When
      vi.advanceTimersByTime(ttlMs - 1);
      const result = await lock.isLocked(resource);

      // Then
      expect(result).toBe(true);
    });
  });

  describe("만료", () => {
    it("TTL이 서로 다른 잠금은 각자의 TTL이 지나면 풀린다", async () => {
      // Given
      const resource1 = "todo:1:reminder";
      const resource2 = "todo:2:reminder";
      await lock.acquire(resource1, 5_000);
      await lock.acquire(resource2, 10_000);

      // When
      vi.advanceTimersByTime(30_000);

      // Then
      expect(await lock.isLocked(resource1)).toBe(false);
      expect(await lock.isLocked(resource2)).toBe(false);
    });

    it("TTL이 남은 잠금은 시간이 지나도 유지된다", async () => {
      // Given
      const resource = "todo:1:reminder";
      await lock.acquire(resource, 60_000);

      // When
      vi.advanceTimersByTime(30_000);

      // Then
      expect(await lock.isLocked(resource)).toBe(true);
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
        await lock.acquire(`resource:${index}`, 1_000);
      }
      vi.advanceTimersByTime(1_001);

      // When
      const release = await lock.acquire("resource:after-expiry", 60_000);

      // Then
      expect(release).not.toBeNull();
    });
  });
});
