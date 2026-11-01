import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt } from "drizzle-orm";

import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user } from "#api/platform/database/schema/index";

import type {
  AiQuotaRepositoryPort,
  AiQuotaState,
} from "../../../application/ports/quotas/ai-quota.repository.port.js";
import { resolvePremiumAccessDeadline } from "../../../domain/policies/entitlement/entitlement-limits.policy.js";

@Injectable()
export class DrizzleAiQuotaRepository implements AiQuotaRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  async findQuotaState(userId: string): Promise<AiQuotaState | null> {
    const row = await this.txHost.tx.query.user.findFirst({
      columns: {
        role: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        aiUsageCount: true,
        aiUsageResetAt: true,
      },
      where: { id: userId },
      with: {
        subscriptions: {
          columns: { expiresAt: true },
          where: { status: "ACTIVE", deletedAt: { isNull: true } },
        },
      },
    });
    return row == null
      ? null
      : {
          role: row.role,
          subscriptionStatus: row.subscriptionStatus,
          accessDeadline: resolvePremiumAccessDeadline({
            subscriptionExpiresAt: row.subscriptionExpiresAt,
            renewingStoreExpiresAt: row.subscriptions.map((subscription) => subscription.expiresAt),
          }),
          count: row.aiUsageCount,
          resetAt: row.aiUsageResetAt,
        };
  }

  async saveUsage(userId: string, input: { count: number; resetAt: Date }): Promise<void> {
    const updated = await this.txHost.tx
      .update(user)
      .set({ aiUsageCount: input.count, aiUsageResetAt: input.resetAt })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (updated.length === 0) {
      throw new DatabaseRecordNotFoundError();
    }
  }

  async releaseUsage(
    userId: string,
    input: { count: number; expectedResetAt: Date },
  ): Promise<boolean> {
    const updated = await this.txHost.tx
      .update(user)
      .set({ aiUsageCount: input.count })
      .where(
        and(
          eq(user.id, userId),
          eq(user.aiUsageResetAt, input.expectedResetAt),
          gt(user.aiUsageCount, 0),
        ),
      )
      .returning({ id: user.id });
    return updated.length === 1;
  }
}
