import type { QuotaMeter } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { quotaUsage } from "#api/platform/database/schema/access.schema";
import { user } from "#api/platform/database/schema/identity.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { QuotaUsageRepositoryPort } from "../../application/ports/quota-usage.repository.port.js";
import { QuotaWindow } from "../../domain/quota-window.vo.js";

interface AiPlanCounter {
  readonly count: number;
  readonly resetAt: Temporal.Instant;
}

/**
 * AI_PLAN은 출시 앱 /v1/ai/usage·/me와 같은 User.aiUsageCount·aiUsageResetAt을, 나머지 계량기는 QuotaUsage를
 * 센다. 더하고 빼는 연산은 Application이 잡은 사용자 행 잠금 안에서 실행된다.
 */
@Injectable()
export class DrizzleQuotaUsageRepository extends QuotaUsageRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async countUsage(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly window: QuotaWindow;
  }): Promise<number> {
    const { userId, meter, window } = params;
    return match(meter)
      .with("AI_PLAN", async () => {
        const counter = await this.#findAiPlanCounter(userId);
        return counter != null && window.contains(counter.resetAt) ? counter.count : 0;
      })
      .with("VOICE_NOTE", async () => {
        const [row] = await this.#db
          .select({ used: quotaUsage.used })
          .from(quotaUsage)
          .where(
            and(
              eq(quotaUsage.userId, userId.value),
              eq(quotaUsage.meter, meter),
              eq(quotaUsage.periodKey, window.periodKey),
            ),
          );
        return row?.used ?? 0;
      })
      .exhaustive();
  }

  async addUsageWithinLimit(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly window: QuotaWindow;
    readonly amount: number;
    readonly limit: number | null;
    readonly now: Temporal.Instant;
  }): Promise<boolean> {
    const { userId, meter, window, amount, limit, now } = params;
    if (limit != null && amount > limit) {
      return false;
    }
    return match(meter)
      .with("AI_PLAN", async () => {
        const counter = requireRecord(await this.#findAiPlanCounter(userId));
        const isCurrent = window.contains(counter.resetAt);
        const used = isCurrent ? counter.count : 0;
        if (limit != null && used + amount > limit) {
          return false;
        }
        // 출시 앱과 같은 의미: 새 기간의 첫 사용 시각을 aiUsageResetAt에 남긴다
        const updated = await this.#db
          .update(user)
          .set({
            aiUsageCount: used + amount,
            aiUsageResetAt: isCurrent ? counter.resetAt : now,
            updatedAt: now,
          })
          .where(and(eq(user.id, userId.value), eq(user.aiUsageCount, counter.count)))
          .returning({ id: user.id });
        return updated.length === 1;
      })
      .with("VOICE_NOTE", async () => {
        const added = await this.#db
          .insert(quotaUsage)
          .values({
            userId: userId.value,
            meter,
            periodKey: window.periodKey,
            used: amount,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [quotaUsage.userId, quotaUsage.meter, quotaUsage.periodKey],
            set: { used: sql`${quotaUsage.used} + ${amount}`, updatedAt: now },
            setWhere: limit == null ? undefined : sql`${quotaUsage.used} + ${amount} <= ${limit}`,
          })
          .returning({ used: quotaUsage.used });
        return added.length === 1;
      })
      .exhaustive();
  }

  async subtractUsage(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly periodKey: string;
    readonly amount: number;
    readonly now: Temporal.Instant;
  }): Promise<boolean> {
    const { userId, meter, periodKey, amount, now } = params;
    return match(meter)
      .with("AI_PLAN", async () => {
        const counter = await this.#findAiPlanCounter(userId);
        if (counter == null || QuotaWindow.monthOf(counter.resetAt).periodKey !== periodKey) {
          return false;
        }
        const updated = await this.#db
          .update(user)
          .set({ aiUsageCount: sql`${user.aiUsageCount} - ${amount}`, updatedAt: now })
          .where(
            and(
              eq(user.id, userId.value),
              eq(user.aiUsageResetAt, counter.resetAt),
              gte(user.aiUsageCount, amount),
            ),
          )
          .returning({ id: user.id });
        return updated.length === 1;
      })
      .with("VOICE_NOTE", async () => {
        const updated = await this.#db
          .update(quotaUsage)
          // 옮기기 전 $onUpdate처럼 뺀 행의 수정 시각도 바꾼다
          .set({ used: sql`${quotaUsage.used} - ${amount}`, updatedAt: now })
          .where(
            and(
              eq(quotaUsage.userId, userId.value),
              eq(quotaUsage.meter, meter),
              eq(quotaUsage.periodKey, periodKey),
              gte(quotaUsage.used, amount),
            ),
          )
          .returning({ used: quotaUsage.used });
        return updated.length === 1;
      })
      .exhaustive();
  }

  async #findAiPlanCounter(userId: UserId): Promise<AiPlanCounter | null> {
    const [row] = await this.#db
      .select({ count: user.aiUsageCount, resetAt: user.aiUsageResetAt })
      .from(user)
      .where(eq(user.id, userId.value));
    return row ?? null;
  }
}
