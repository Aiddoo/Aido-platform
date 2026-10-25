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
  /** 초대한 사람으로 받은 보상을 종류별로 한 번에 집계한다. 받은 수와 관계없이 결과는 종류 수만큼이다. */
  summarizeInviterRewards(inviterId: string, windowStart: Date): Promise<InviterRewardTotal[]>;
  findBySource(sourceType: RewardSourceType, sourceId: string): Promise<RewardGrantRecord[]>;
  /** PENDING·FAILED일 때만 APPLIED로 바꾼다. 다른 작업이 먼저 적용했으면 false다. */
  markApplied(grantId: string, appliedAt: Date): Promise<boolean>;
  markFailed(grantId: string, errorCode: string, failedAt: Date): Promise<void>;
  findRetryableSourceIds(params: FindRetryableRewardSourcesParams): Promise<string[]>;
}
