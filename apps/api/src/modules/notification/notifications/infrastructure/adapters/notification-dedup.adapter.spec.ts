import type { DedupEntry, DedupProviderPort } from "#api/platform/dedup/dedup-provider.port";

import { NotificationDedupAdapter } from "./notification-dedup.adapter.js";

interface AddedMembers {
  readonly setKey: string;
  readonly members: readonly string[];
  readonly ttlMs: number;
}

// Set 키별 멤버와 TTL을 남겨 저장 계약(key·sentinel·TTL)을 상태로 확인한다
class RecordingDedupProvider implements DedupProviderPort {
  readonly added: AddedMembers[] = [];
  readonly #sets = new Map<string, Set<string>>();

  async filterMembers(setKey: string, members: string[]): Promise<Set<string>> {
    const stored = this.#sets.get(setKey) ?? new Set<string>();
    return new Set(members.filter((member) => stored.has(member)));
  }

  async filterEntries<TEntry extends DedupEntry>(entries: readonly TEntry[]): Promise<TEntry[]> {
    return entries.filter(({ setKey, member }) => this.#sets.get(setKey)?.has(member) === true);
  }

  async addMembers(setKey: string, members: string[], ttlMs: number): Promise<void> {
    this.added.push({ setKey, members, ttlMs });
    const stored = this.#sets.get(setKey) ?? new Set<string>();
    for (const member of members) {
      stored.add(member);
    }
    this.#sets.set(setKey, stored);
  }

  async addEntries(entries: readonly DedupEntry[], ttlMs: number): Promise<void> {
    for (const { setKey, member } of entries) {
      await this.addMembers(setKey, [member], ttlMs);
    }
  }
}

describe("NotificationDedupAdapter", () => {
  it("application dedup records를 인프라 key와 sentinel 계약으로 저장한다", async () => {
    // Given
    const provider = new RecordingDedupProvider();
    const adapter = new NotificationDedupAdapter(provider);

    // When
    await adapter.recordNotifiedUsers([
      {
        userId: "u1",
        type: "FRIEND_COMPLETED",
        notificationDate: Temporal.PlainDate.from("2026-03-09"),
      },
      {
        userId: "u2",
        type: "FRIEND_COMPLETED",
        notificationDate: Temporal.PlainDate.from("2026-03-09"),
      },
    ]);

    // Then
    expect(provider.added).toEqual([
      {
        setKey: "aido:v1:notification:dedup-notified:FRIEND_COMPLETED:2026-03-09",
        members: ["__init__", "u1", "u2"],
        ttlMs: 90_000_000,
      },
    ]);
  });
});
