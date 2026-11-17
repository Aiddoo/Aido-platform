import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { ValueObject } from "#api/shared/domain/model/value-object";

interface NudgePairMarkValue {
  // ISO 주 식별자(isoWeekIdOf, 예: "2026-W10")
  readonly weekId: string;
  readonly recipientId: UserId;
  readonly friendId: UserId;
}

// 그 주에 한 사용자에게 그 친구를 찔러보라고 이미 제안했다는 표시다. 주마다 쌍당 한 번이다
export class NudgePairMark extends ValueObject<NudgePairMarkValue> {
  static create(value: NudgePairMarkValue): NudgePairMark {
    return new NudgePairMark({ ...value });
  }

  get weekId(): string {
    return this.value.weekId;
  }

  get recipientId(): UserId {
    return this.value.recipientId;
  }

  get friendId(): UserId {
    return this.value.friendId;
  }
}
