import { setTimeout as sleep } from "node:timers/promises";

import type { ThrottlerStorage } from "@nestjs/throttler";

/**
 * 모든 ThrottlerStorage 구현이 통과해야 하는 계약. 기준은 @nestjs/throttler 기본 in-memory 저장소다.
 * CACHE_TYPE=redis로 바꿔도 429 판단과 Retry-After·X-RateLimit-Reset(초) 헤더가 같아야 한다.
 */
export function describeThrottlerStorageContract(context: {
  readonly name: string;
  readonly createStorage: () => ThrottlerStorage;
}): void {
  describe(`ThrottlerStorage 계약 — ${context.name}`, () => {
    let storage: ThrottlerStorage;

    beforeEach(() => {
      storage = context.createStorage();
    });

    it("한도 안의 요청은 막지 않고 횟수와 남은 창을 초로 준다", async () => {
      // Given
      await storage.increment("contract:client", 60_000, 5, 60_000, "default");
      await storage.increment("contract:client", 60_000, 5, 60_000, "default");

      // When
      const record = await storage.increment("contract:client", 60_000, 5, 60_000, "default");

      // Then
      expect(record).toMatchObject({ totalHits: 3, isBlocked: false });
      expect(record.timeToExpire).toBeGreaterThanOrEqual(59);
      expect(record.timeToExpire).toBeLessThanOrEqual(60);
    });

    it("한도를 넘으면 막고 남은 차단 시간을 초로 준다", async () => {
      // Given
      await storage.increment("contract:client", 60_000, 2, 30_000, "default");
      await storage.increment("contract:client", 60_000, 2, 30_000, "default");

      // When
      const record = await storage.increment("contract:client", 60_000, 2, 30_000, "default");

      // Then
      expect(record).toMatchObject({ totalHits: 3, isBlocked: true });
      expect(record.timeToBlockExpire).toBeGreaterThanOrEqual(29);
      expect(record.timeToBlockExpire).toBeLessThanOrEqual(30);
    });

    it("차단 중인 요청은 횟수를 더 올리지 않는다", async () => {
      // Given
      for (let hit = 0; hit < 3; hit += 1) {
        await storage.increment("contract:client", 60_000, 2, 30_000, "default");
      }

      // When
      const record = await storage.increment("contract:client", 60_000, 2, 30_000, "default");

      // Then
      expect(record).toMatchObject({ totalHits: 3, isBlocked: true });
    });

    it("창이 지나면 횟수를 처음부터 센다", async () => {
      // Given
      await storage.increment("contract:client", 100, 5, 100, "default");
      await storage.increment("contract:client", 100, 5, 100, "default");

      // When
      await sleep(250);
      const record = await storage.increment("contract:client", 100, 5, 100, "default");

      // Then
      expect(record).toMatchObject({ totalHits: 1, isBlocked: false });
    });

    it("키와 throttler 이름이 다르면 따로 센다", async () => {
      // Given
      await storage.increment("contract:first", 60_000, 5, 60_000, "short");
      await storage.increment("contract:first", 60_000, 5, 60_000, "short");

      // When
      const otherThrottler = await storage.increment("contract:first", 60_000, 5, 60_000, "long");
      const otherKey = await storage.increment("contract:second", 60_000, 5, 60_000, "short");

      // Then
      expect(otherThrottler.totalHits).toBe(1);
      expect(otherKey.totalHits).toBe(1);
    });
  });
}
