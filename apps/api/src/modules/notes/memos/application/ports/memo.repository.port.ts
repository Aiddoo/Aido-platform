import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { MemoId } from "../../domain/memo-id.vo.js";
import type { SortOrderShift } from "../../domain/memo-ordering.domain-service.js";
import type { Memo } from "../../domain/memo.aggregate.js";

export abstract class MemoRepositoryPort {
  abstract nextId(): Promise<MemoId>;
  abstract findByIdAndUserId(memoId: MemoId, userId: UserId): Promise<Memo | null>;
  abstract findByIdempotencyKey(userId: UserId, idempotencyKey: string): Promise<Memo | null>;
  // 고정 메모 먼저, 그다음 sortOrder·id 내림차순이다. after 메모 뒤부터 주고 그 메모가 없거나 남의 것이면 빈 목록이다
  abstract listByUserId(params: {
    readonly userId: UserId;
    readonly afterMemoId: MemoId | null;
    readonly limit: number;
  }): Promise<Memo[]>;
  abstract countByUserId(userId: UserId): Promise<number>;
  abstract findMaxSortOrder(userId: UserId): Promise<number | null>;
  abstract shiftSortOrders(
    userId: UserId,
    shift: SortOrderShift,
    now: Temporal.Instant,
  ): Promise<void>;
  /** 같은 사용자의 같은 Idempotency-Key를 가진 다른 메모가 있으면 MemoIdempotencyKeyTakenError를 던진다 */
  abstract save(memo: Memo): Promise<void>;
  abstract delete(memo: Memo): Promise<void>;
}
