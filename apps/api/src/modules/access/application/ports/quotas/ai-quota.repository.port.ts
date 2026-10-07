import type { AiQuotaUsageSnapshot } from "../../../domain/aggregates/quotas/ai-quota-usage.aggregate.js";

export const AI_QUOTA_REPOSITORY = Symbol("AI_QUOTA_REPOSITORY");

export interface AiQuotaState extends AiQuotaUsageSnapshot {
  readonly resetAt: Date;
  readonly role: string;
  readonly subscriptionStatus: string;
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
