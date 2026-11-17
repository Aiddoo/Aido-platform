import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user } from "#api/platform/database/schema/identity.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  UserAiUsageCounter,
  UserAiUsageCounterPort,
} from "../../application/ports/user-ai-usage-counter.port.js";

@Injectable()
export class DrizzleUserAiUsageCounterAdapter implements UserAiUsageCounterPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  async findByUserId(userId: UserId): Promise<UserAiUsageCounter | null> {
    const [row] = await this.#db
      .select({ count: user.aiUsageCount, resetAt: user.aiUsageResetAt })
      .from(user)
      .where(eq(user.id, userId.value));
    return row ?? null;
  }

  async replaceIfUnchanged(params: {
    readonly userId: UserId;
    readonly expectedCount: number;
    readonly counter: UserAiUsageCounter;
    readonly now: Temporal.Instant;
  }): Promise<boolean> {
    const updated = await this.#db
      .update(user)
      .set({
        aiUsageCount: params.counter.count,
        aiUsageResetAt: params.counter.resetAt,
        updatedAt: params.now,
      })
      .where(and(eq(user.id, params.userId.value), eq(user.aiUsageCount, params.expectedCount)))
      .returning({ id: user.id });
    return updated.length === 1;
  }

  async subtractInPeriod(params: {
    readonly userId: UserId;
    readonly resetAt: Temporal.Instant;
    readonly amount: number;
    readonly now: Temporal.Instant;
  }): Promise<boolean> {
    const updated = await this.#db
      .update(user)
      .set({ aiUsageCount: sql`${user.aiUsageCount} - ${params.amount}`, updatedAt: params.now })
      .where(
        and(
          eq(user.id, params.userId.value),
          eq(user.aiUsageResetAt, params.resetAt),
          gte(user.aiUsageCount, params.amount),
        ),
      )
      .returning({ id: user.id });
    return updated.length === 1;
  }
}
