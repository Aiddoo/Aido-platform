import type {
  CheerReaderPort,
  ListCheersParams,
} from "#api/modules/social/cheers/application/ports/cheer.reader.port";
import { CheerRepositoryPort } from "#api/modules/social/cheers/application/ports/cheer.repository.port";
import type {
  CheerListItem,
  CheerUserSummary,
} from "#api/modules/social/cheers/application/read-models/cheer.read-model";
import { CheerId } from "#api/modules/social/cheers/domain/cheer-id.vo";
import { Cheer } from "#api/modules/social/cheers/domain/cheer.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// Drizzle 저장소와 같은 순서(생성 시각·id 내림차순)로 나열한다
function compareListOrder(left: Cheer, right: Cheer): number {
  return (
    Temporal.Instant.compare(right.createdAt, left.createdAt) || right.id.value - left.id.value
  );
}

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(cheer: Cheer): Cheer {
  return Cheer.reconstitute(cheer.toPrimitives());
}

// 차단 관계는 다루지 않는다. 차단 제외는 실제 PostgreSQL integration에서 본다
export class InMemoryCheerRepository extends CheerRepositoryPort implements CheerReaderPort {
  readonly #cheers = new Map<number, Cheer>();
  readonly #users = new Map<string, CheerUserSummary>();
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

  addUser(user: CheerUserSummary): void {
    this.#users.set(user.id, user);
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
      .toSorted(compareListOrder);
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

  async listReceived(params: ListCheersParams): Promise<CheerListItem[]> {
    return this.#listOwned(params, (cheer) => cheer.receiverId.equals(params.userId));
  }

  async listSent(params: ListCheersParams): Promise<CheerListItem[]> {
    return this.#listOwned(params, (cheer) => cheer.senderId.equals(params.userId));
  }

  async countReceived(userId: UserId): Promise<number> {
    return [...this.#cheers.values()].filter((cheer) => cheer.receiverId.equals(userId)).length;
  }

  async countSent(userId: UserId): Promise<number> {
    return [...this.#cheers.values()].filter((cheer) => cheer.senderId.equals(userId)).length;
  }

  async countUnreadReceived(userId: UserId): Promise<number> {
    return [...this.#cheers.values()].filter(
      (cheer) => cheer.receiverId.equals(userId) && cheer.readAt == null,
    ).length;
  }

  #listOwned(params: ListCheersParams, isOwned: (cheer: Cheer) => boolean): CheerListItem[] {
    const anchor = params.afterCheerId == null ? null : this.#cheers.get(params.afterCheerId.value);
    if (params.afterCheerId != null && anchor == null) {
      return [];
    }
    return [...this.#cheers.values()]
      .filter(isOwned)
      .filter((cheer) => anchor == null || compareListOrder(anchor, cheer) < 0)
      .toSorted(compareListOrder)
      .slice(0, params.limit)
      .map((cheer) => this.#toListItem(cheer));
  }

  #toListItem(cheer: Cheer): CheerListItem {
    const primitives = cheer.toPrimitives();
    return {
      ...primitives,
      sender: this.#userSummary(primitives.senderId),
      receiver: this.#userSummary(primitives.receiverId),
    };
  }

  #userSummary(userId: string): CheerUserSummary {
    return (
      this.#users.get(userId) ?? { id: userId, userTag: userId, name: null, profileImage: null }
    );
  }
}
