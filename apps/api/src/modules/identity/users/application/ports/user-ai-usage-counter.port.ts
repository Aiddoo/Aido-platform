import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface UserAiUsageCounter {
  readonly count: number;
  /** 이 기간의 첫 사용 시각. 기간 판단은 access 원장이 한다 */
  readonly resetAt: Temporal.Instant;
}

/**
 * User 행의 AI 사용량 칸(aiUsageCount·aiUsageResetAt)을 읽고 바꾸는 유일한 문이다. 출시 앱 /v1/ai/usage·/me와
 * 같은 칸이라 User 행에 두고, access 원장이 사용자 행 잠금 안에서 부른다. 활성 트랜잭션에 함께 커밋된다.
 */
export abstract class UserAiUsageCounterPort {
  /** 사용자가 없으면 null이다. */
  abstract findByUserId(userId: UserId): Promise<UserAiUsageCounter | null>;
  /** 읽은 count가 그대로일 때만 새 값으로 바꾸고 true다. */
  abstract replaceIfUnchanged(params: {
    readonly userId: UserId;
    readonly expectedCount: number;
    readonly counter: UserAiUsageCounter;
    readonly now: Temporal.Instant;
  }): Promise<boolean>;
  /** 읽은 기간(resetAt)이 그대로이고 amount 이상 남았을 때만 빼고 true다. */
  abstract subtractInPeriod(params: {
    readonly userId: UserId;
    readonly resetAt: Temporal.Instant;
    readonly amount: number;
    readonly now: Temporal.Instant;
  }): Promise<boolean>;
}
