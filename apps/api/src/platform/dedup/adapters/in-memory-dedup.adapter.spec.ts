import { describeDedupProviderContract } from "#test/contracts/platform/dedup-provider.contract";

import { DEDUP_MAX_ENTRIES, InMemoryDedupAdapter } from "./in-memory-dedup.adapter.js";

describeDedupProviderContract({
  name: "InMemoryDedupAdapter",
  createProvider: () => new InMemoryDedupAdapter(),
});

describe("InMemoryDedupAdapter — 크기 상한", () => {
  it("Set 키가 상한을 넘으면 가장 오래 안 쓴 키부터 버려 크기를 상한 안에 둔다", async () => {
    // Given
    const dedup = new InMemoryDedupAdapter();
    await dedup.addMembers("set:oldest", ["member"], 60_000);

    // When
    for (let index = 0; index < DEDUP_MAX_ENTRIES; index += 1) {
      await dedup.addMembers(`set:${index}`, ["member"], 60_000);
    }

    // Then
    expect(await dedup.isMember("set:oldest", "member")).toBe(false);
    expect(await dedup.isMember(`set:${DEDUP_MAX_ENTRIES - 1}`, "member")).toBe(true);
  });
});
