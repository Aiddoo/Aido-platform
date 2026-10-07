import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodePatch } from "#api/platform/database/database-records";
import { databaseTimestamp } from "#api/platform/database/database-values";
import { DatabaseRecordNotFoundError } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  AiQuotaRepositoryPort,
  AiQuotaState,
} from "../../../application/ports/quotas/ai-quota.repository.port.js";

@Injectable()
export class PrismaAiQuotaRepository implements AiQuotaRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  async findQuotaState(userId: string): Promise<AiQuotaState | null> {
    const row = decodeRecord(
      "User",
      await this.txHost.tx.orm.public.User.where((row) => row.id.eq(userId))
        .select("role", "subscriptionStatus", "aiUsageCount", "aiUsageResetAt")
        .first(),
    );
    return row === null
      ? null
      : {
          role: row.role,
          subscriptionStatus: row.subscriptionStatus,
          count: row.aiUsageCount,
          resetAt: row.aiUsageResetAt,
        };
  }

  async saveUsage(userId: string, input: { count: number; resetAt: Date }): Promise<void> {
    const updated = await this.txHost.tx.orm.public.User.where((row) =>
      row.id.eq(userId),
    ).updateAndCount(
      encodePatch("User", {
        aiUsageCount: input.count,
        aiUsageResetAt: input.resetAt,
      }),
    );
    if (updated === 0) throw new DatabaseRecordNotFoundError();
  }

  async releaseUsage(
    userId: string,
    input: { count: number; expectedResetAt: Date },
  ): Promise<boolean> {
    const updated = await this.txHost.tx.orm.public.User.where((row) =>
      and(
        row.id.eq(userId),
        row.aiUsageResetAt.eq(databaseTimestamp(input.expectedResetAt)),
        row.aiUsageCount.gt(0),
      ),
    ).updateAndCount(encodePatch("User", { aiUsageCount: input.count }));
    return updated === 1;
  }
}
