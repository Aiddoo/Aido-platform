import type { QuotaChargeStatus, QuotaMeter } from "@aido/api/vocabulary";

import type { AccessState } from "#api/modules/access/entitlements/domain/entitlement.domain-service";
import type { QuotaLedgerRepositoryPort } from "#api/modules/access/quotas/application/ports/quota-ledger.repository.port";
import type { QuotaUserMutationLockPort } from "#api/modules/access/quotas/application/ports/quota-user-mutation-lock.port";
import {
  QuotaCharge,
  type QuotaChargeDraft,
  type QuotaChargeProps,
} from "#api/modules/access/quotas/domain/quota-charge.aggregate";
import { QuotaWindow } from "#api/modules/access/quotas/domain/quota-window.vo";

/** 원장 저장소에 보이는 사용자 행. AI_PLAN은 User.aiUsageCount·aiUsageResetAt과 같은 의미다. */
export interface InMemoryQuotaUser extends AccessState {
  aiUsageCount: number;
  aiUsageResetAt: Date;
}

/** 사용자 잠금 안에서 쓰는 원장 저장소의 메모리 구현. 동시성 의미는 integration이 실제 DB로 확인한다. */
export class InMemoryQuotaLedgerRepository implements QuotaLedgerRepositoryPort {
  readonly users = new Map<string, InMemoryQuotaUser>();
  readonly usage = new Map<string, number>();
  readonly charges = new Map<string, QuotaChargeProps>();
  #sequence = 0;

  async findAccessState(userId: string): Promise<AccessState | null> {
    const user = this.users.get(userId);
    return user === undefined
      ? null
      : {
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          accessDeadline: user.accessDeadline,
        };
  }

  async readUsed(userId: string, meter: QuotaMeter, window: QuotaWindow): Promise<number> {
    if (meter === "AI_PLAN") {
      const user = this.users.get(userId);
      return user !== undefined && window.contains(user.aiUsageResetAt) ? user.aiUsageCount : 0;
    }
    return this.usage.get(usageKey(userId, meter, window.periodKey)) ?? 0;
  }

  async addUsage(
    userId: string,
    meter: QuotaMeter,
    input: { window: QuotaWindow; at: Date; amount: number; limit: number | null },
  ): Promise<boolean> {
    const used = await this.readUsed(userId, meter, input.window);
    if (input.limit != null && used + input.amount > input.limit) {
      return false;
    }
    if (meter === "AI_PLAN") {
      const user = this.users.get(userId);
      if (user === undefined) {
        return false;
      }
      user.aiUsageResetAt = input.window.contains(user.aiUsageResetAt)
        ? user.aiUsageResetAt
        : new Date(input.at);
      user.aiUsageCount = used + input.amount;
      return true;
    }
    this.usage.set(usageKey(userId, meter, input.window.periodKey), used + input.amount);
    return true;
  }

  async subtractUsage(
    userId: string,
    meter: QuotaMeter,
    input: { periodKey: string; amount: number },
  ): Promise<boolean> {
    if (meter === "AI_PLAN") {
      const user = this.users.get(userId);
      if (
        user === undefined ||
        QuotaWindow.resolvePeriodKey(user.aiUsageResetAt) !== input.periodKey ||
        user.aiUsageCount < input.amount
      ) {
        return false;
      }
      user.aiUsageCount -= input.amount;
      return true;
    }
    const key = usageKey(userId, meter, input.periodKey);
    const used = this.usage.get(key) ?? 0;
    if (used < input.amount) {
      return false;
    }
    this.usage.set(key, used - input.amount);
    return true;
  }

  async findCharge(chargeId: string): Promise<QuotaCharge | null> {
    const props = this.charges.get(chargeId);
    return props === undefined ? null : QuotaCharge.reconstitute(props);
  }

  async findAbandonedReservations(cutoff: Date, limit: number): Promise<readonly QuotaCharge[]> {
    return [...this.charges.values()]
      .filter((charge) => charge.status === "RESERVED" && charge.updatedAt <= cutoff)
      .toSorted((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
      .slice(0, limit)
      .map((charge) => QuotaCharge.reconstitute(charge));
  }

  async countReservationsBefore(cutoff: Date): Promise<number> {
    return [...this.charges.values()].filter(
      (charge) => charge.status === "RESERVED" && charge.updatedAt <= cutoff,
    ).length;
  }

  async clearRequestHashesBefore(cutoff: Date, limit: number): Promise<number> {
    const stale = [...this.charges.values()]
      .filter((charge) => charge.requestHash != null && charge.createdAt <= cutoff)
      .slice(0, limit);
    for (const charge of stale) {
      this.charges.set(charge.id, { ...charge, requestHash: null });
    }
    return stale.length;
  }

  async findChargeByKey(
    userId: string,
    meter: QuotaMeter,
    idempotencyKey: string,
  ): Promise<QuotaCharge | null> {
    const props = [...this.charges.values()].find(
      (charge) =>
        charge.userId === userId &&
        charge.meter === meter &&
        charge.idempotencyKey === idempotencyKey,
    );
    return props === undefined ? null : QuotaCharge.reconstitute(props);
  }

  async insertCharge(draft: QuotaChargeDraft): Promise<QuotaCharge> {
    this.#sequence += 1;
    const props: QuotaChargeProps = {
      ...draft,
      id: `charge-${this.#sequence}`,
      createdAt: new Date(draft.updatedAt),
    };
    this.charges.set(props.id, props);
    return QuotaCharge.reconstitute(props);
  }

  async updateCharge(
    charge: QuotaCharge,
    expected: { status: QuotaChargeStatus; attempt: number },
  ): Promise<boolean> {
    const stored = this.charges.get(charge.id);
    if (
      stored === undefined ||
      stored.status !== expected.status ||
      stored.attempt !== expected.attempt
    ) {
      return false;
    }
    this.charges.set(charge.id, {
      ...stored,
      status: charge.status,
      attempt: charge.attempt,
      reason: charge.reason,
      refundReason: charge.refundReason,
      periodKey: charge.periodKey,
      updatedAt: charge.updatedAt,
    });
    return true;
  }
}

export class StubQuotaUserMutationLock implements QuotaUserMutationLockPort {
  constructor(readonly repository: InMemoryQuotaLedgerRepository) {}

  async lockById(userId: string): Promise<boolean> {
    return this.repository.users.has(userId);
  }
}

function usageKey(userId: string, meter: QuotaMeter, periodKey: string): string {
  return `${userId}:${meter}:${periodKey}`;
}
