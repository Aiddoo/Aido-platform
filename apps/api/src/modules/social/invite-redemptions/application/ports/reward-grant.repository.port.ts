import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import type { RewardGrantId } from "../../domain/reward-grant-id.vo.js";
import type { RewardGrant } from "../../domain/reward-grant.entity.js";

export interface RewardGrantFailure {
  readonly errorCode: string;
  readonly failedAt: Temporal.Instant;
  /** false면(큐 재시도) 시도 횟수를 늘리지 않는다. */
  readonly countsAttempt: boolean;
}

// 보상 지급 작업 원장이다. 묶음 저장·조건부 적용 표시·재시도 선택을 업무 이름의 원장 연산으로 둔다(persistence.md)
export abstract class RewardGrantRepositoryPort {
  // 한 문장으로 PENDING을 저장한다. 같은 (출처, 받는 사람, 종류)가 이미 있으면 건너뛰고 새로 저장한 수를 반환한다
  abstract addPending(grants: readonly RewardGrant[]): Promise<number>;
  /** 수락 한 건의 지급을 id 오름차순으로 읽는다. */
  abstract listByRedemptionId(redemptionId: InviteRedemptionId): Promise<RewardGrant[]>;
  /** PENDING·FAILED일 때만 APPLIED로 바꾼다. 다른 작업이 먼저 적용했으면 false다. */
  abstract markApplied(grantId: RewardGrantId, appliedAt: Temporal.Instant): Promise<boolean>;
  /** APPLIED가 아니면 FAILED로 바꾸고 바뀐 뒤 시도 횟수를 반환한다. 이미 APPLIED면 null이다. */
  abstract markFailed(grantId: RewardGrantId, failure: RewardGrantFailure): Promise<number | null>;
  /**
   * 적용하지 못한 지급(PENDING·FAILED, 시도 maxAttempts 미만, createdBefore 이하)이 남은 수락을 id 오름차순으로
   * 한 번씩 읽는다. afterRedemptionId 뒤부터 준다.
   */
  abstract listRetryableRedemptionIds(params: {
    readonly maxAttempts: number;
    readonly createdBefore: Temporal.Instant;
    readonly afterRedemptionId: InviteRedemptionId | null;
    readonly limit: number;
  }): Promise<InviteRedemptionId[]>;
}
