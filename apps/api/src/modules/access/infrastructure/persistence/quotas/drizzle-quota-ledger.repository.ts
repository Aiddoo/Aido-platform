import type { QuotaChargeStatus, QuotaMeter } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { quotaCharge, quotaUsage, user } from "#api/platform/database/schema/index";

import type { QuotaLedgerRepositoryPort } from "../../../application/ports/quotas/quota-ledger.repository.port.js";
import {
  QuotaCharge,
  type QuotaChargeDraft,
} from "../../../domain/aggregates/quotas/quota-charge.aggregate.js";
import type { AccessState } from "../../../domain/policies/entitlement/entitlement.policy.js";
import { resolvePremiumAccessDeadline } from "../../../domain/policies/entitlement/paid-access.policy.js";
import { QuotaWindow } from "../../../domain/value-objects/quotas/quota-window.vo.js";

type QuotaChargeRow = typeof quotaCharge.$inferSelect;

function toQuotaCharge(row: QuotaChargeRow): QuotaCharge {
  return QuotaCharge.reconstitute(row);
}

/**
 * AI_PLAN은 출시 앱 /v1/ai/usage·/me와 같은 User.aiUsageCount·aiUsageResetAt을, 나머지 계량기는 QuotaUsage를
 * 센다. 예약·환불은 Application이 잡은 사용자 행 잠금 안에서 실행된다.
 */
@Injectable()
export class DrizzleQuotaLedgerRepository implements QuotaLedgerRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  async findAccessState(userId: string): Promise<AccessState | null> {
    const row = await this.txHost.tx.query.user.findFirst({
      columns: { role: true, subscriptionStatus: true, subscriptionExpiresAt: true },
      where: { id: userId },
      with: {
        subscriptions: {
          columns: { status: true, expiresAt: true, gracePeriodEndsAt: true },
          where: { status: { in: ["ACTIVE", "CANCELLED"] }, deletedAt: { isNull: true } },
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
            storeEntitlements: row.subscriptions,
          }),
        };
  }

  async readUsed(userId: string, meter: QuotaMeter, window: QuotaWindow): Promise<number> {
    return match(meter)
      .with("AI_PLAN", async () => {
        const counter = await this.#findAiPlanCounter(userId);
        return counter != null && window.contains(counter.resetAt) ? counter.count : 0;
      })
      .with("VOICE_NOTE", async () => {
        const [row] = await this.txHost.tx
          .select({ used: quotaUsage.used })
          .from(quotaUsage)
          .where(
            and(
              eq(quotaUsage.userId, userId),
              eq(quotaUsage.meter, meter),
              eq(quotaUsage.periodKey, window.periodKey),
            ),
          );
        return row?.used ?? 0;
      })
      .exhaustive();
  }

  async addUsage(
    userId: string,
    meter: QuotaMeter,
    input: { window: QuotaWindow; at: Date; amount: number; limit: number | null },
  ): Promise<boolean> {
    const { window, at, amount, limit } = input;
    if (limit != null && amount > limit) {
      return false;
    }
    return match(meter)
      .with("AI_PLAN", async () => {
        const counter = requireRecord(await this.#findAiPlanCounter(userId));
        const current = window.contains(counter.resetAt);
        const used = current ? counter.count : 0;
        if (limit != null && used + amount > limit) {
          return false;
        }
        // 출시 앱과 같은 의미: 새 기간의 첫 사용 시각을 aiUsageResetAt에 남긴다
        const updated = await this.txHost.tx
          .update(user)
          .set({ aiUsageCount: used + amount, aiUsageResetAt: current ? counter.resetAt : at })
          .where(and(eq(user.id, userId), eq(user.aiUsageCount, counter.count)))
          .returning({ id: user.id });
        return updated.length === 1;
      })
      .with("VOICE_NOTE", async () => {
        const added = await this.txHost.tx
          .insert(quotaUsage)
          .values({ userId, meter, periodKey: window.periodKey, used: amount, updatedAt: at })
          .onConflictDoUpdate({
            target: [quotaUsage.userId, quotaUsage.meter, quotaUsage.periodKey],
            set: { used: sql`${quotaUsage.used} + ${amount}`, updatedAt: at },
            setWhere: limit == null ? undefined : sql`${quotaUsage.used} + ${amount} <= ${limit}`,
          })
          .returning({ used: quotaUsage.used });
        return added.length === 1;
      })
      .exhaustive();
  }

  async subtractUsage(
    userId: string,
    meter: QuotaMeter,
    input: { periodKey: string; amount: number },
  ): Promise<boolean> {
    const { periodKey, amount } = input;
    return match(meter)
      .with("AI_PLAN", async () => {
        const counter = await this.#findAiPlanCounter(userId);
        if (counter == null || QuotaWindow.periodKeyOf(counter.resetAt) !== periodKey) {
          return false;
        }
        const updated = await this.txHost.tx
          .update(user)
          .set({ aiUsageCount: sql`${user.aiUsageCount} - ${amount}` })
          .where(
            and(
              eq(user.id, userId),
              eq(user.aiUsageResetAt, counter.resetAt),
              gte(user.aiUsageCount, amount),
            ),
          )
          .returning({ id: user.id });
        return updated.length === 1;
      })
      .with("VOICE_NOTE", async () => {
        const updated = await this.txHost.tx
          .update(quotaUsage)
          .set({ used: sql`${quotaUsage.used} - ${amount}` })
          .where(
            and(
              eq(quotaUsage.userId, userId),
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

  async findCharge(chargeId: string): Promise<QuotaCharge | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(quotaCharge)
      .where(eq(quotaCharge.id, chargeId));
    return row == null ? null : toQuotaCharge(row);
  }

  async findAbandonedReservations(cutoff: Date, limit: number): Promise<readonly QuotaCharge[]> {
    const rows = await this.txHost.tx
      .select()
      .from(quotaCharge)
      .where(and(eq(quotaCharge.status, "RESERVED"), lte(quotaCharge.updatedAt, cutoff)))
      .orderBy(asc(quotaCharge.updatedAt))
      .limit(limit);
    return rows.map(toQuotaCharge);
  }

  async findChargeByKey(
    userId: string,
    meter: QuotaMeter,
    idempotencyKey: string,
  ): Promise<QuotaCharge | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(quotaCharge)
      .where(
        and(
          eq(quotaCharge.userId, userId),
          eq(quotaCharge.meter, meter),
          eq(quotaCharge.idempotencyKey, idempotencyKey),
        ),
      );
    return row == null ? null : toQuotaCharge(row);
  }

  async insertCharge(draft: QuotaChargeDraft): Promise<QuotaCharge> {
    const [row] = await this.txHost.tx.insert(quotaCharge).values(draft).returning();
    return toQuotaCharge(requireRecord(row));
  }

  async updateCharge(
    charge: QuotaCharge,
    expected: { status: QuotaChargeStatus; attempt: number },
  ): Promise<boolean> {
    const updated = await this.txHost.tx
      .update(quotaCharge)
      .set({
        status: charge.status,
        attempt: charge.attempt,
        reason: charge.reason,
        refundReason: charge.refundReason,
        periodKey: charge.periodKey,
        updatedAt: charge.updatedAt,
      })
      .where(
        and(
          eq(quotaCharge.id, charge.id),
          eq(quotaCharge.status, expected.status),
          eq(quotaCharge.attempt, expected.attempt),
        ),
      )
      .returning({ id: quotaCharge.id });
    return updated.length === 1;
  }

  async #findAiPlanCounter(userId: string): Promise<{ count: number; resetAt: Date } | null> {
    const [row] = await this.txHost.tx
      .select({ count: user.aiUsageCount, resetAt: user.aiUsageResetAt })
      .from(user)
      .where(eq(user.id, userId));
    return row ?? null;
  }
}
