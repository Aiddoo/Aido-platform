import type { QuotaMeter } from "@aido/api/vocabulary";

import { QuotaUsageRepositoryPort } from "#api/modules/access/quotas/application/ports/quota-usage.repository.port";
import { QuotaWindow } from "#api/modules/access/quotas/domain/quota-window.vo";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InMemoryAccessUser } from "./in-memory-access-state.reader.js";

function usageKey(userId: string, meter: QuotaMeter, periodKey: string): string {
  return `${userId}:${meter}:${periodKey}`;
}

/** AI_PLAN은 사용자 행(aiUsageCount·aiUsageResetAt)을, 나머지 계량기는 기간별 카운터를 센다. */
export class InMemoryQuotaUsageRepository extends QuotaUsageRepositoryPort {
  readonly users: Map<string, InMemoryAccessUser>;
  readonly #usage = new Map<string, number>();

  constructor(users: Map<string, InMemoryAccessUser> = new Map()) {
    super();
    this.users = users;
  }

  /** AI_PLAN 밖 계량기의 기간 카운터를 바로 정한다(이미 쓴 상태를 만들 때) */
  setUsage(params: {
    readonly userId: string;
    readonly meter: Exclude<QuotaMeter, "AI_PLAN">;
    readonly periodKey: string;
    readonly used: number;
  }): void {
    this.#usage.set(usageKey(params.userId, params.meter, params.periodKey), params.used);
  }

  async countUsage(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly window: QuotaWindow;
  }): Promise<number> {
    const { userId, meter, window } = params;
    if (meter === "AI_PLAN") {
      const user = this.users.get(userId.value);
      return user != null && window.contains(user.aiUsageResetAt) ? user.aiUsageCount : 0;
    }
    return this.#usage.get(usageKey(userId.value, meter, window.periodKey)) ?? 0;
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
    const used = await this.countUsage(params);
    if (limit != null && used + amount > limit) {
      return false;
    }
    if (meter === "AI_PLAN") {
      const user = this.users.get(userId.value);
      if (user == null) {
        return false;
      }
      user.aiUsageResetAt = window.contains(user.aiUsageResetAt) ? user.aiUsageResetAt : now;
      user.aiUsageCount = used + amount;
      return true;
    }
    this.#usage.set(usageKey(userId.value, meter, window.periodKey), used + amount);
    return true;
  }

  async subtractUsage(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly periodKey: string;
    readonly amount: number;
    readonly now: Temporal.Instant;
  }): Promise<boolean> {
    const { userId, meter, periodKey, amount } = params;
    if (meter === "AI_PLAN") {
      const user = this.users.get(userId.value);
      if (
        user == null ||
        QuotaWindow.monthOf(user.aiUsageResetAt).periodKey !== periodKey ||
        user.aiUsageCount < amount
      ) {
        return false;
      }
      user.aiUsageCount -= amount;
      return true;
    }
    const key = usageKey(userId.value, meter, periodKey);
    const used = this.#usage.get(key) ?? 0;
    if (used < amount) {
      return false;
    }
    this.#usage.set(key, used - amount);
    return true;
  }
}
