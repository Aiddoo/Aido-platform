import { DedupProviderPort, type DedupEntry } from "#api/platform/dedup/dedup-provider.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgePairMark } from "../../domain/nudge-pair-mark.vo.js";
import { WinbackStageMark } from "../../domain/winback-stage-mark.vo.js";
import { SchedulerDeduplicationAdapter } from "./scheduler-deduplication.adapter.js";

const DAY_MS = 24 * 60 * 60_000;

// 받은 키·멤버·TTL을 그대로 남기고, presentMembers에 있는 멤버를 이미 기록된 것으로 본다
class RecordingDedupProvider extends DedupProviderPort {
  readonly added: { readonly setKey: string; readonly member: string; readonly ttlMs: number }[] =
    [];
  readonly asked: { readonly setKey: string; readonly member: string }[] = [];
  readonly #presentMembers: ReadonlySet<string>;

  constructor(presentMembers: readonly string[] = []) {
    super();
    this.#presentMembers = new Set(presentMembers);
  }

  async filterMembers(setKey: string, members: string[]): Promise<Set<string>> {
    this.asked.push(...members.map((member) => ({ setKey, member })));
    return new Set(members.filter((member) => this.#presentMembers.has(member)));
  }

  async filterEntries<TEntry extends DedupEntry>(entries: readonly TEntry[]): Promise<TEntry[]> {
    this.asked.push(...entries.map(({ setKey, member }) => ({ setKey, member })));
    return entries.filter(({ member }) => this.#presentMembers.has(member));
  }

  async addMembers(setKey: string, members: string[], ttlMs: number): Promise<void> {
    this.added.push(...members.map((member) => ({ setKey, member, ttlMs })));
  }

  async addEntries(entries: readonly DedupEntry[], ttlMs: number): Promise<void> {
    this.added.push(...entries.map(({ setKey, member }) => ({ setKey, member, ttlMs })));
  }
}

describe("SchedulerDeduplicationAdapter — 출시 중 Redis 키 고정", () => {
  it("윈백 단계 표시는 사용자별 집합 키와 단계 멤버를 그대로 쓴다", async () => {
    // Given
    const provider = new RecordingDedupProvider(["day7"]);
    const adapter = new SchedulerDeduplicationAdapter(provider);
    const sent = WinbackStageMark.create({
      recipientId: UserId.reconstitute("user-1"),
      stage: "day7",
    });
    const fresh = WinbackStageMark.create({
      recipientId: UserId.reconstitute("user-2"),
      stage: "day14",
    });

    // When
    const unsent = await adapter.filterUnsentWinbackStages([sent, fresh]);
    await adapter.recordWinbackStages([fresh]);

    // Then
    expect(unsent).toEqual([fresh]);
    expect(provider.asked).toEqual([
      { setKey: "aido:v1:scheduler:dedup-winback-stages:user-1", member: "day7" },
      { setKey: "aido:v1:scheduler:dedup-winback-stages:user-2", member: "day14" },
    ]);
    expect(provider.added).toEqual([
      {
        setKey: "aido:v1:scheduler:dedup-winback-stages:user-2",
        member: "day14",
        ttlMs: 90 * DAY_MS,
      },
    ]);
  });

  it("넛지 쌍 표시는 주별 집합 키와 '받는 사람:친구' 멤버를 그대로 쓴다", async () => {
    // Given
    const provider = new RecordingDedupProvider(["user-1:friend-1"]);
    const adapter = new SchedulerDeduplicationAdapter(provider);
    const pairOf = (recipientId: string, friendId: string) =>
      NudgePairMark.create({
        weekId: "2026-W10",
        recipientId: UserId.reconstitute(recipientId),
        friendId: UserId.reconstitute(friendId),
      });
    const sent = pairOf("user-1", "friend-1");
    const fresh = pairOf("user-1", "friend-2");

    // When
    const unsent = await adapter.filterUnsentNudgePairs([sent, fresh]);
    await adapter.recordNudgePairs([fresh]);

    // Then
    expect(unsent).toEqual([fresh]);
    expect(provider.asked).toEqual([
      { setKey: "aido:v1:scheduler:dedup-nudge-suggest:2026-W10", member: "user-1:friend-1" },
      { setKey: "aido:v1:scheduler:dedup-nudge-suggest:2026-W10", member: "user-1:friend-2" },
    ]);
    expect(provider.added).toEqual([
      {
        setKey: "aido:v1:scheduler:dedup-nudge-suggest:2026-W10",
        member: "user-1:friend-2",
        ttlMs: 8 * DAY_MS,
      },
    ]);
  });
});
