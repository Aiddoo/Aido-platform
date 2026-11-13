import { MemoIdempotencyKeyTakenError } from "#api/modules/notes/memos/application/memos.errors";
import { MemoRepositoryPort } from "#api/modules/notes/memos/application/ports/memo.repository.port";
import { MemoId } from "#api/modules/notes/memos/domain/memo-id.vo";
import type { SortOrderShift } from "#api/modules/notes/memos/domain/memo-ordering.domain-service";
import { Memo } from "#api/modules/notes/memos/domain/memo.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// Drizzle 저장소와 같은 순서(고정 먼저, sortOrder·id 내림차순)로 나열한다
function compareListOrder(left: Memo, right: Memo): number {
  return (
    Number(right.isPinned) - Number(left.isPinned) ||
    right.sortOrder - left.sortOrder ||
    right.id.value - left.id.value
  );
}

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(memo: Memo): Memo {
  return Memo.reconstitute(memo.toPrimitives());
}

export class InMemoryMemoRepository extends MemoRepositoryPort {
  readonly #memos = new Map<number, Memo>();
  #sequence: number;

  constructor(memos: readonly Memo[] = []) {
    super();
    for (const memo of memos) {
      this.#memos.set(memo.id.value, copyOf(memo));
    }
    this.#sequence = Math.max(0, ...this.#memos.keys());
  }

  get size(): number {
    return this.#memos.size;
  }

  async nextId(): Promise<MemoId> {
    this.#sequence += 1;
    return MemoId.reconstitute(this.#sequence);
  }

  async findByIdAndUserId(memoId: MemoId, userId: UserId): Promise<Memo | null> {
    const memo = this.#memos.get(memoId.value);
    return memo != null && memo.userId.equals(userId) ? copyOf(memo) : null;
  }

  async findByIdempotencyKey(userId: UserId, idempotencyKey: string): Promise<Memo | null> {
    const memo = [...this.#memos.values()].find(
      (candidate) =>
        candidate.userId.equals(userId) &&
        candidate.toPrimitives().idempotencyKey === idempotencyKey,
    );
    return memo == null ? null : copyOf(memo);
  }

  async listByUserId(params: {
    readonly userId: UserId;
    readonly afterMemoId: MemoId | null;
    readonly limit: number;
  }): Promise<Memo[]> {
    const { userId, afterMemoId, limit } = params;
    const owned = [...this.#memos.values()]
      .filter((memo) => memo.userId.equals(userId))
      .toSorted(compareListOrder);
    if (afterMemoId == null) {
      return owned.slice(0, limit).map(copyOf);
    }
    const anchorIndex = owned.findIndex((memo) => memo.id.equals(afterMemoId));
    return anchorIndex === -1
      ? []
      : owned.slice(anchorIndex + 1, anchorIndex + 1 + limit).map(copyOf);
  }

  async countByUserId(userId: UserId): Promise<number> {
    return [...this.#memos.values()].filter((memo) => memo.userId.equals(userId)).length;
  }

  async findMaxSortOrder(userId: UserId): Promise<number | null> {
    const sortOrders = [...this.#memos.values()]
      .filter((memo) => memo.userId.equals(userId))
      .map((memo) => memo.sortOrder);
    return sortOrders.length === 0 ? null : Math.max(...sortOrders);
  }

  async shiftSortOrders(
    userId: UserId,
    shift: SortOrderShift,
    now: Temporal.Instant,
  ): Promise<void> {
    for (const memo of this.#memos.values()) {
      const isInRange =
        shift.fromSortOrder <= memo.sortOrder &&
        (shift.toSortOrder == null || memo.sortOrder <= shift.toSortOrder);
      if (memo.userId.equals(userId) && isInRange) {
        memo.moveTo(memo.sortOrder + shift.delta, now);
      }
    }
  }

  async save(memo: Memo): Promise<void> {
    // Drizzle의 (userId, idempotencyKey) 부분 unique 제약과 같다
    const { idempotencyKey } = memo.toPrimitives();
    const isKeyTaken =
      idempotencyKey != null &&
      [...this.#memos.values()].some(
        (other) =>
          !other.id.equals(memo.id) &&
          other.userId.equals(memo.userId) &&
          other.toPrimitives().idempotencyKey === idempotencyKey,
      );
    if (isKeyTaken) {
      throw new MemoIdempotencyKeyTakenError();
    }
    this.#memos.set(memo.id.value, copyOf(memo));
  }

  async delete(memo: Memo): Promise<void> {
    this.#memos.delete(memo.id.value);
  }
}
