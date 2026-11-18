import type { QuotaMeter } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { UserAiUsageCounterPort } from "#api/modules/identity/users/identity-users.public";
import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { quotaUsage } from "#api/platform/database/schema/access.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { QuotaWindow } from "../../../shared/domain/quota-window.vo.js";
import type { QuotaUsageRepositoryPort } from "../../application/ports/quota-usage.repository.port.js";

/**
 * AI_PLAN은 출시 앱 /v1/ai/usage·/me와 같은 User.aiUsageCount·aiUsageResetAt을 identity 포트로, 나머지 계량기는
 * QuotaUsage를 센다. 더하고 빼는 연산은 Application이 잡은 사용자 행 잠금 안에서 실행된다.
 */
@Injectable()
export class DrizzleQuotaUsageRepository implements QuotaUsageRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #aiUsageCounter: UserAiUsageCounterPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    aiUsageCounter: UserAiUsageCounterPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#aiUsageCounter = aiUsageCounter;
  }

  async countUsage(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly window: QuotaWindow;
  }): Promise<number> {
    const { userId, meter, window } = params;
    return match(meter)
      .with("AI_PLAN", async () => {
        const counter = await this.#aiUsageCounter.findByUserId(userId);
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
        const counter = requireRecord(await this.#aiUsageCounter.findByUserId(userId));
        const isCurrent = window.contains(counter.resetAt);
        const used = isCurrent ? counter.count : 0;
        if (limit != null && used + amount > limit) {
          return false;
        }
        // 출시 앱과 같은 의미: 새 기간의 첫 사용 시각을 aiUsageResetAt에 남긴다
        return this.#aiUsageCounter.replaceIfUnchanged({
          userId,
          expectedCount: counter.count,
          counter: { count: used + amount, resetAt: isCurrent ? counter.resetAt : now },
          now,
        });
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
        const counter = await this.#aiUsageCounter.findByUserId(userId);
        if (counter == null || QuotaWindow.create(counter.resetAt).periodKey !== periodKey) {
          return false;
        }
        return this.#aiUsageCounter.subtractInPeriod({
          userId,
          resetAt: counter.resetAt,
          amount,
          now,
        });
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

  get #db() {
    return this.#transactionHost.tx;
  }
}
