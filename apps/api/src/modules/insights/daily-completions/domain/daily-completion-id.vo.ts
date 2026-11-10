import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { EntityId } from "#api/shared/domain/model/entity-id";

/** 저장하지 않는 집계라 사용자와 달력 날짜가 곧 식별자다. */
export class DailyCompletionId extends EntityId<string> {
  static create(params: {
    readonly userId: UserId;
    readonly date: Temporal.PlainDate;
  }): DailyCompletionId {
    return new DailyCompletionId(`${params.userId.value}:${params.date.toString()}`);
  }
}
