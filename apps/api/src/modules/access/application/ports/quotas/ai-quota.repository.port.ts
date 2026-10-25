import type { AiQuotaUsageSnapshot } from "../../../domain/aggregates/quotas/ai-quota-usage.aggregate.js";

export const AI_QUOTA_REPOSITORY = Symbol("AI_QUOTA_REPOSITORY");

export interface AiQuotaState extends AiQuotaUsageSnapshot {
  readonly resetAt: Date;
  readonly role: string;
  readonly subscriptionStatus: string;
  /** ACTIVE projection이 끝나는 시각. 엔타이틀먼트 판단과 같은 기준이다. */
  readonly accessDeadline: Date | null;
}

export interface AiQuotaRepositoryPort {
  findQuotaState(userId: string): Promise<AiQuotaState | null>;
  saveUsage(
    userId: string,
    input: { readonly count: number; readonly resetAt: Date },
  ): Promise<void>;
  releaseUsage(
    userId: string,
    input: { readonly count: number; readonly expectedResetAt: Date },
  ): Promise<boolean>;
}
