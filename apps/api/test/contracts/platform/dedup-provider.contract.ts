import { setTimeout as sleep } from "node:timers/promises";

import type { DedupProviderPort } from "#api/platform/dedup/dedup-provider.port";

/**
 * 모든 DedupProviderPort 구현(in-memory, Redis, Valkey)이 통과해야 하는 계약.
 * 저장소를 바꿔도 리마인더·알림 중복 방지가 그대로 동작한다는 증거라 새 구현은 이 suite를 함께 돌린다.
 */
export function describeDedupProviderContract(context: {
  readonly name: string;
  readonly createProvider: () => DedupProviderPort;
}): void {
  describe(`DedupProviderPort 계약 — ${context.name}`, () => {
    let dedup: DedupProviderPort;

    beforeEach(() => {
      dedup = context.createProvider();
    });

    it("Set에 있는 멤버만 골라 준다", async () => {
      // Given
      await dedup.addMembers("contract:set", ["a", "b"], 60_000);

      // When
      const existing = await dedup.filterMembers("contract:set", ["a", "b", "c"]);

      // Then
      expect(existing).toEqual(new Set(["a", "b"]));
    });

    it("빈 목록은 빈 Set이고 빈 추가는 아무것도 남기지 않는다", async () => {
      // When
      await dedup.addMembers("contract:empty", [], 60_000);

      // Then
      expect(await dedup.filterMembers("contract:empty", [])).toEqual(new Set());
      expect(await dedup.filterMembers("contract:empty", ["a"])).toEqual(new Set());
    });

    it("isMember는 한 멤버가 있는지 알려 준다", async () => {
      // Given
      await dedup.addMembers("contract:set", ["a"], 60_000);

      // When / Then
      expect(await dedup.isMember("contract:set", "a")).toBe(true);
      expect(await dedup.isMember("contract:set", "b")).toBe(false);
      expect(await dedup.isMember("contract:missing", "a")).toBe(false);
    });

    it("Set 키가 다르면 따로 저장한다", async () => {
      // Given
      await dedup.addMembers("contract:first", ["a"], 60_000);

      // When / Then
      expect(await dedup.isMember("contract:second", "a")).toBe(false);
    });

    it("멤버를 다시 더하면 Redis PEXPIRE처럼 Set 전체의 TTL을 그때부터 다시 잰다", async () => {
      // Given
      await dedup.addMembers("contract:set", ["D3"], 600);
      await sleep(350);
      await dedup.addMembers("contract:set", ["D7"], 600);

      // When
      await sleep(350);
      const beforeExpiry = await dedup.filterMembers("contract:set", ["D3", "D7", "D14"]);
      await sleep(350);
      const afterExpiry = await dedup.isMember("contract:set", "D3");

      // Then
      expect(beforeExpiry).toEqual(new Set(["D3", "D7"]));
      expect(afterExpiry).toBe(false);
    });
  });
}
