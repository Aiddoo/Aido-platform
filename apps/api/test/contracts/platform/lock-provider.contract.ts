import { setTimeout as sleep } from "node:timers/promises";

import type { ILockProvider } from "#api/platform/lock/interfaces/lock.interface";

/**
 * 모든 ILockProvider 구현(in-memory, Redis, Valkey)이 통과해야 하는 계약.
 * LOCK 설정을 바꿔도 웹훅·알림 처리 잠금이 그대로 동작한다는 증거라 새 구현은 이 suite를 함께 돌린다.
 */
export function describeLockProviderContract(context: {
  readonly name: string;
  readonly createProvider: () => ILockProvider;
}): void {
  describe(`ILockProvider 계약 — ${context.name}`, () => {
    let lock: ILockProvider;

    beforeEach(() => {
      lock = context.createProvider();
    });

    it("잠금을 얻으면 release 함수를 주고 그동안 잠긴 상태다", async () => {
      // When
      const release = await lock.acquire("contract:resource", 5_000);

      // Then
      expect(release).toBeTypeOf("function");
      expect(await lock.isLocked("contract:resource")).toBe(true);
    });

    it("이미 잠긴 리소스는 null이다", async () => {
      // Given
      await lock.acquire("contract:resource", 5_000);

      // When
      const second = await lock.acquire("contract:resource", 5_000);

      // Then
      expect(second).toBeNull();
    });

    it("release 뒤에는 풀리고 다시 얻을 수 있다", async () => {
      // Given
      const release = await lock.acquire("contract:resource", 5_000);

      // When
      await release?.();

      // Then
      expect(await lock.isLocked("contract:resource")).toBe(false);
      expect(await lock.acquire("contract:resource", 5_000)).toBeTypeOf("function");
    });

    it("잠기지 않은 리소스의 isLocked는 false다", async () => {
      // When / Then
      expect(await lock.isLocked("contract:free")).toBe(false);
    });

    it("서로 다른 리소스는 따로 잠긴다", async () => {
      // Given
      await lock.acquire("contract:first", 5_000);

      // When
      const other = await lock.acquire("contract:second", 5_000);

      // Then
      expect(other).toBeTypeOf("function");
    });

    it("TTL이 지나면 잠금이 저절로 풀린다", async () => {
      // Given
      await lock.acquire("contract:resource", 50);

      // When
      await sleep(150);

      // Then
      expect(await lock.isLocked("contract:resource")).toBe(false);
      expect(await lock.acquire("contract:resource", 5_000)).toBeTypeOf("function");
    });

    it("TTL이 지난 뒤 늦게 부른 release는 다음 소유자의 잠금을 풀지 않는다", async () => {
      // Given
      const staleRelease = await lock.acquire("contract:resource", 50);
      await sleep(150);
      await lock.acquire("contract:resource", 5_000);

      // When
      await staleRelease?.();

      // Then
      expect(await lock.isLocked("contract:resource")).toBe(true);
      expect(await lock.acquire("contract:resource", 5_000)).toBeNull();
    });
  });
}
