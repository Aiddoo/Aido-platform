import type { RewardType } from "@aido/api/vocabulary";

import type { InviterRewardTotal } from "../../../domain/policies/invites/invite-reward.policy.js";
import type {
  RewardGrantPlan,
  RewardGrantStatusValue,
  RewardSourceType,
} from "../../../domain/types/invites/reward-grant.types.js";

export interface RewardGrantRecord {
  readonly id: string;
  readonly recipientId: string;
  readonly sourceType: RewardSourceType;
  readonly sourceId: string;
  readonly rewardType: RewardType;
  readonly quantity: number;
  readonly status: RewardGrantStatusValue;
  readonly attempts: number;
  readonly createdAt: Date;
}

export interface FindRetryableRewardSourcesParams {
  readonly maxAttempts: number;
  readonly createdBefore: Date;
  readonly afterSourceId?: string;
  readonly limit: number;
}

export const REWARD_GRANT_REPOSITORY = Symbol("REWARD_GRANT_REPOSITORY");

export interface RewardGrantRepositoryPort {
  /** 한 SQL로 저장한다. 같은 (출처, 받는 사람, 종류)가 이미 있으면 건너뛴다. */
  createPending(plans: readonly RewardGrantPlan[]): Promise<number>;
  /**
   * 초대한 사람으로 받은 보상을 종류별로 한 번에 집계한다. 받은 수와 관계없이 결과는 종류 수만큼이다.
   * 자동 재시도를 다 쓴 FAILED 지급은 받지 못한 보상이라 상한 계산에서 뺀다.
   */
  summarizeInviterRewards(inviterId: string, windowStart: Date): Promise<InviterRewardTotal[]>;
  findBySource(sourceType: RewardSourceType, sourceId: string): Promise<RewardGrantRecord[]>;
  /** PENDING·FAILED일 때만 APPLIED로 바꾼다. 다른 작업이 먼저 적용했으면 false다. */
  markApplied(grantId: string, appliedAt: Date): Promise<boolean>;
  /**
   * APPLIED가 아니면 FAILED로 바꾸고 바뀐 뒤 시도 횟수를 반환한다. 이미 APPLIED면 null이다.
   * countsAttempt가 false면(큐 재시도) 시도 횟수를 늘리지 않는다.
   */
  markFailed(
    grantId: string,
    failure: {
      readonly errorCode: string;
      readonly failedAt: Date;
      readonly countsAttempt: boolean;
    },
  ): Promise<number | null>;
  findRetryableSourceIds(params: FindRetryableRewardSourcesParams): Promise<string[]>;
}
