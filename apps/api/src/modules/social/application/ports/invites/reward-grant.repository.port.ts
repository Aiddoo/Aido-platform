import type { RewardType } from "@aido/api/vocabulary";

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

/** 초대한 사람으로 받은 보상 한 건 (상한·누적 계산용) */
export interface InviterRewardLedgerEntry {
  readonly rewardType: RewardType;
  readonly quantity: number;
  readonly status: RewardGrantStatusValue;
  readonly grantedAt: Date;
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
  findInviterLedger(inviterId: string): Promise<InviterRewardLedgerEntry[]>;
  findBySource(sourceType: RewardSourceType, sourceId: string): Promise<RewardGrantRecord[]>;
  /** PENDING·FAILED일 때만 APPLIED로 바꾼다. 다른 작업이 먼저 적용했으면 false다. */
  markApplied(grantId: string, appliedAt: Date): Promise<boolean>;
  markFailed(grantId: string, errorCode: string, failedAt: Date): Promise<void>;
  findRetryableSourceIds(params: FindRetryableRewardSourcesParams): Promise<string[]>;
}
