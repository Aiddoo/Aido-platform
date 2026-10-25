import type { RevenueCatWebhookPayload } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { pickBy } from "es-toolkit";

import type { PremiumGrantRepositoryPort } from "#api/modules/billing/application/ports/subscriptions/premium-grant.repository.port";
import type { SubscriptionCachePort } from "#api/modules/billing/application/ports/subscriptions/subscription-cache.port";
import type { SubscriptionEventNotifierPort } from "#api/modules/billing/application/ports/subscriptions/subscription-event-notifier.port";
import type {
  ClaimSubscriptionEventReceiptInput,
  SubscriptionEventReceiptRepositoryPort,
} from "#api/modules/billing/application/ports/subscriptions/subscription-event-receipt.repository.port";
import type { SubscriptionUserMutationLockPort } from "#api/modules/billing/application/ports/subscriptions/subscription-user-mutation-lock.port";
import type { SubscriptionWebhookLockPort } from "#api/modules/billing/application/ports/subscriptions/subscription-webhook-lock.port";
import type {
  CreateSubscriptionData,
  SubscriptionRepositoryPort,
  SubscriptionUser,
  UpdateSubscriptionStatusData,
  UpdateUserSubscriptionStatusData,
} from "#api/modules/billing/application/ports/subscriptions/subscription.repository.port";
import type { SubscriptionEventPayload } from "#api/modules/billing/application/types/subscriptions/subscription-event.payload";
import {
  PremiumGrant,
  type PremiumGrantCreationPlan,
  type PremiumGrantProps,
} from "#api/modules/billing/domain/aggregates/subscriptions/premium-grant.aggregate";
import {
  Subscription,
  type SubscriptionProps,
} from "#api/modules/billing/domain/aggregates/subscriptions/subscription.aggregate";
import type { StoreSubscriptionEntitlement } from "#api/modules/billing/domain/policies/subscriptions/premium-access.policy";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

export class StubSubscriptionRepository implements SubscriptionRepositoryPort {
  readonly users = new Map<string, SubscriptionUser>();
  readonly subscriptions = new Map<string, SubscriptionProps>();
  /** 다른 사용자에게 옮겨 간 행의 revenueCatId와 표시 시각 */
  readonly transferredAt = new Map<string, Date>();

  async findUserByAppUserId(appUserId: string): Promise<SubscriptionUser | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.id === appUserId || candidate.revenueCatUserId === appUserId,
    );
    return user ? this.#copyUser(user) : null;
  }

  async findUserById(userId: string): Promise<SubscriptionUser | null> {
    const user = this.users.get(userId);
    return user ? this.#copyUser(user) : null;
  }

  async findStoreEntitlements(userId: string): Promise<StoreSubscriptionEntitlement[]> {
    return [...this.subscriptions.values()]
      .filter((record) => record.userId === userId && !this.transferredAt.has(record.revenueCatId))
      .map((record) => ({
        revenueCatId: record.revenueCatId,
        status: record.status,
        expiresAt: new Date(record.expiresAt),
      }));
  }

  async claimChain(revenueCatId: string, userId: string): Promise<boolean> {
    const record = this.subscriptions.get(revenueCatId);
    if (record === undefined) return false;
    if (record.userId === userId && !this.transferredAt.has(revenueCatId)) return false;
    this.subscriptions.set(revenueCatId, { ...record, userId });
    this.transferredAt.delete(revenueCatId);
    return true;
  }

  async markTransferredAway(userId: string, transferredAt: Date): Promise<number> {
    const records = [...this.subscriptions.values()].filter(
      (record) => record.userId === userId && !this.transferredAt.has(record.revenueCatId),
    );
    for (const record of records)
      this.transferredAt.set(record.revenueCatId, new Date(transferredAt));
    return records.length;
  }

  async findByRevenueCatId(revenueCatId: string): Promise<Subscription | null> {
    const record = this.subscriptions.get(revenueCatId);
    return record ? Subscription.reconstitute(record) : null;
  }

  async create(data: CreateSubscriptionData): Promise<void> {
    this.subscriptions.set(data.revenueCatId, {
      ...data,
      id: this.subscriptions.size + 1,
      startedAt: new Date(data.startedAt),
      expiresAt: new Date(data.expiresAt),
      cancelledAt: null,
      lastProcessedEventId: data.lastProcessedEventId ?? null,
    });
  }

  async updateStatus(revenueCatId: string, data: UpdateSubscriptionStatusData): Promise<void> {
    const record = this.subscriptions.get(revenueCatId);
    if (!record)
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
        reason: `Subscription not found: ${revenueCatId}`,
      });
    const cancelledAt = data.cancelledAt === undefined ? record.cancelledAt : data.cancelledAt;
    this.subscriptions.set(revenueCatId, {
      ...record,
      ...pickBy(data, (value) => value !== undefined),
      expiresAt: new Date(data.expiresAt ?? record.expiresAt),
      cancelledAt: cancelledAt === null ? null : new Date(cancelledAt),
    });
  }

  async updateUserSubscriptionStatus(
    userId: string,
    data: UpdateUserSubscriptionStatusData,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (!user) throw new Error("사용자 저장 상태가 없습니다.");
    this.users.set(
      userId,
      this.#copyUser({ ...user, ...pickBy(data, (value) => value !== undefined) }),
    );
  }

  #copyUser(user: SubscriptionUser): SubscriptionUser {
    return {
      ...user,
      subscriptionExpiresAt:
        user.subscriptionExpiresAt === null ? null : new Date(user.subscriptionExpiresAt),
      profile: user.profile === null ? null : { ...user.profile },
    };
  }
}

export class StubSubscriptionCache implements SubscriptionCachePort {
  readonly profiles = new Map<string, { subscriptionStatus: string }>();
  readonly entitlements = new Map<string, { status: string }>();

  async invalidate(userId: string): Promise<void> {
    this.profiles.delete(userId);
    this.entitlements.delete(userId);
  }
}

export class StubSubscriptionNotifier implements SubscriptionEventNotifierPort {
  readonly events: SubscriptionEventPayload[] = [];
  readonly billingIssueUserIds: string[] = [];
  readonly failures: Array<{ error: unknown; payload: RevenueCatWebhookPayload }> = [];

  notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
    this.events.push(payload);
  }
  notifyBillingIssue(userId: string): void {
    this.billingIssueUserIds.push(userId);
  }
  reportWebhookFailure(error: unknown, payload: RevenueCatWebhookPayload): void {
    this.failures.push({ error, payload });
  }
}

export class StubSubscriptionWebhookLock implements SubscriptionWebhookLockPort {
  readonly heldKeys = new Set<string>();

  async acquire(appUserId: string): Promise<(() => Promise<void>) | null> {
    if (this.heldKeys.has(appUserId)) return null;
    this.heldKeys.add(appUserId);
    return async () => {
      this.heldKeys.delete(appUserId);
    };
  }
}

export class StubSubscriptionReceiptRepository implements SubscriptionEventReceiptRepositoryPort {
  readonly receipts = new Map<string, { eventId: string; eventType: string; processedAt: Date }>();

  async claim(input: ClaimSubscriptionEventReceiptInput): Promise<boolean> {
    if (this.receipts.has(input.eventId)) return false;
    this.receipts.set(input.eventId, { ...input, processedAt: new Date(input.processedAt) });
    return true;
  }
}

export class StubSubscriptionUserMutationLock implements SubscriptionUserMutationLockPort {
  readonly lockedUserIds: string[] = [];
  constructor(private readonly repository: StubSubscriptionRepository) {}
  async lockById(userId: string): Promise<boolean> {
    this.lockedUserIds.push(userId);
    return this.repository.users.has(userId);
  }
}

/** 사용자 한 명의 보상 기간 상태만 다루는 저장소 대역. 집합 SQL 동작은 실제 PG에서 확인한다. */
export class StubPremiumGrantRepository implements Pick<
  PremiumGrantRepositoryPort,
  "findOpenByUserId" | "create" | "saveAll"
> {
  readonly grants = new Map<string, PremiumGrantProps>();

  async findOpenByUserId(userId: string): Promise<PremiumGrant[]> {
    return [...this.grants.values()]
      .filter(
        (grant) =>
          grant.userId === userId && (grant.status === "BANKED" || grant.status === "ACTIVE"),
      )
      .map((grant) => PremiumGrant.reconstitute(grant));
  }

  async create(plan: PremiumGrantCreationPlan): Promise<boolean> {
    if ([...this.grants.values()].some((grant) => grant.sourceKey === plan.sourceKey)) return false;
    const id = `grant-${this.grants.size + 1}`;
    this.grants.set(id, { ...plan, id, endingNotifiedAt: null, createdAt: new Date() });
    return true;
  }

  async saveAll(grants: readonly PremiumGrant[]): Promise<void> {
    for (const grant of grants) {
      const current = this.grants.get(grant.id);
      if (current === undefined) continue;
      this.grants.set(grant.id, { ...current, ...grant.toPersistence() });
    }
  }
}
