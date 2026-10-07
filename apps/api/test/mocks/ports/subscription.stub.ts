import type { RevenueCatWebhookPayload } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { pickBy } from "es-toolkit";

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
  Subscription,
  type SubscriptionProps,
} from "#api/modules/billing/domain/aggregates/subscriptions/subscription.aggregate";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

export class StubSubscriptionRepository implements SubscriptionRepositoryPort {
  readonly users = new Map<string, SubscriptionUser>();
  readonly subscriptions = new Map<string, SubscriptionProps>();

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

  async findOtherEntitlementExpiry(
    userId: string,
    excludedRevenueCatId: string,
    at: Date,
  ): Promise<Date | null> {
    let latestExpiry: Date | null = null;
    for (const record of this.subscriptions.values()) {
      if (record.userId !== userId || record.revenueCatId === excludedRevenueCatId) continue;
      if (record.status !== "ACTIVE" && record.status !== "CANCELLED") continue;
      if (record.expiresAt.getTime() <= at.getTime()) continue;
      if (latestExpiry === null || record.expiresAt.getTime() > latestExpiry.getTime())
        latestExpiry = record.expiresAt;
    }
    return latestExpiry === null ? null : new Date(latestExpiry);
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
