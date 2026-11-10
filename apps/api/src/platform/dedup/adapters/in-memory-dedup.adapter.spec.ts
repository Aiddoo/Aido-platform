import { vi } from "vitest";

import { DEDUP_MAX_ENTRIES, InMemoryDedupAdapter } from "./in-memory-dedup.adapter.js";

describe("InMemoryDedupAdapter — 인메모리 중복 방지", () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date("2026-07-15T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("멤버를 다시 더하면 Redis PEXPIRE처럼 Set 전체의 TTL을 그때부터 다시 잰다", async () => {
    // Given
    const dedup = new InMemoryDedupAdapter();
    await dedup.addMembers("winback:user-1", ["D3"], 1_000);
    vi.advanceTimersByTime(800);
    await dedup.addMembers("winback:user-1", ["D7"], 1_000);

    // When
    vi.advanceTimersByTime(800);
    const beforeExpiry = await dedup.filterMembers("winback:user-1", ["D3", "D7", "D14"]);
    vi.advanceTimersByTime(201);
    const afterExpiry = await dedup.isMember("winback:user-1", "D3");

    // Then
    expect(beforeExpiry).toEqual(new Set(["D3", "D7"]));
    expect(afterExpiry).toBe(false);
  });

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
