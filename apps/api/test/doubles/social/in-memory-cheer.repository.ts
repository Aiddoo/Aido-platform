import { CheerRepositoryPort } from "#api/modules/social/cheers/application/ports/cheer.repository.port";
import { CheerId } from "#api/modules/social/cheers/domain/cheer-id.vo";
import { Cheer } from "#api/modules/social/cheers/domain/cheer.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function compareCreatedDescending(left: Cheer, right: Cheer): number {
  return (
    Temporal.Instant.compare(right.createdAt, left.createdAt) || right.id.value - left.id.value
  );
}

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(cheer: Cheer): Cheer {
  return Cheer.reconstitute(cheer.toPrimitives());
}

export class InMemoryCheerRepository extends CheerRepositoryPort {
  readonly #cheers = new Map<number, Cheer>();
  #sequence: number;

  constructor(cheers: readonly Cheer[] = []) {
    super();
    for (const cheer of cheers) {
      this.#cheers.set(cheer.id.value, copyOf(cheer));
    }
    this.#sequence = Math.max(0, ...this.#cheers.keys());
  }

  get size(): number {
    return this.#cheers.size;
  }

  async nextId(): Promise<CheerId> {
    this.#sequence += 1;
    return CheerId.reconstitute(this.#sequence);
  }

  async findById(cheerId: CheerId): Promise<Cheer | null> {
    const cheer = this.#cheers.get(cheerId.value);
    return cheer == null ? null : copyOf(cheer);
  }

  async findLastSent(senderId: UserId, receiverId: UserId): Promise<Cheer | null> {
    const [last] = [...this.#cheers.values()]
      .filter((cheer) => cheer.senderId.equals(senderId) && cheer.receiverId.equals(receiverId))
      .toSorted(compareCreatedDescending);
    return last == null ? null : copyOf(last);
  }

  async countSentBetween(
    senderId: UserId,
    window: { readonly startsAt: Temporal.Instant; readonly endsAt: Temporal.Instant },
  ): Promise<number> {
    return [...this.#cheers.values()].filter(
      (cheer) =>
        cheer.senderId.equals(senderId) &&
        Temporal.Instant.compare(window.startsAt, cheer.createdAt) <= 0 &&
        Temporal.Instant.compare(cheer.createdAt, window.endsAt) < 0,
    ).length;
  }

  async save(cheer: Cheer): Promise<void> {
    this.#cheers.set(cheer.id.value, copyOf(cheer));
  }

  async markManyRead(params: {
    readonly receiverId: UserId;
    readonly cheerIds: readonly CheerId[];
    readonly now: Temporal.Instant;
  }): Promise<number> {
    const ids = new Set(params.cheerIds.map((cheerId) => cheerId.value));
    let count = 0;
    for (const id of ids) {
      const cheer = this.#cheers.get(id);
      if (cheer != null && cheer.isReceivedBy(params.receiverId) && cheer.markRead(params.now)) {
        count += 1;
      }
    }
    return count;
  }

  // InMemory 조회 대역이 같은 상태를 읽도록 연다(저장 순서)
  listAll(): Cheer[] {
    return [...this.#cheers.values()].map(copyOf);
  }
}
