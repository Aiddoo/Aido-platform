import { ErrorCode } from "@aido/api/errors";
import { pickBy } from "es-toolkit";

import type { PremiumGrantRepositoryPort } from "#api/modules/billing/application/ports/subscriptions/premium-grant.repository.port";
import type { StoreSubscriptionReconcileSchedulerPort } from "#api/modules/billing/application/ports/subscriptions/store-subscription-reconcile.scheduler.port";
import type { StoreSubscriptionStatusReaderPort } from "#api/modules/billing/application/ports/subscriptions/store-subscription-status.reader.port";
import type { SubscriptionCachePort } from "#api/modules/billing/application/ports/subscriptions/subscription-cache.port";
import type {
  SubscriptionEventNotifierPort,
  StoreSubscriptionEventFailureContext,
} from "#api/modules/billing/application/ports/subscriptions/subscription-event-notifier.port";
import type {
  ClaimSubscriptionEventReceiptInput,
  SubscriptionEventReceiptRepositoryPort,
} from "#api/modules/billing/application/ports/subscriptions/subscription-event-receipt.repository.port";
import type { SubscriptionUserMutationLockPort } from "#api/modules/billing/application/ports/subscriptions/subscription-user-mutation-lock.port";
import type { SubscriptionWebhookLockPort } from "#api/modules/billing/application/ports/subscriptions/subscription-webhook-lock.port";
import type {
  CreateSubscriptionData,
  FindLapsedPremiumUsersParams,
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
  type StoreSubscriptionState,
  Subscription,
  type SubscriptionProps,
} from "#api/modules/billing/domain/aggregates/subscriptions/subscription.aggregate";
import type { StoreSubscriptionEntitlement } from "#api/modules/billing/domain/policies/subscriptions/premium-access.policy";
import { StoreSubscriptionId } from "#api/modules/billing/domain/value-objects/subscriptions/store-subscription-id.vo";
import { ApplicationException } from "#api/shared/application/application.exception";

/** 저장소 대역의 사용자. appUserAlias는 스토어가 User.id 대신 쓰는 별칭(DB 칸 User.revenueCatUserId)이다. */
export interface StubSubscriptionUser extends SubscriptionUser {
  readonly appUserAlias?: string | null;
}

export class StubSubscriptionRepository implements SubscriptionRepositoryPort {
  readonly users = new Map<string, StubSubscriptionUser>();
  readonly subscriptions = new Map<string, SubscriptionProps>();
  readonly lapsedPremiumUserIds: string[] = [];

  async findUserByAppUserId(appUserId: string): Promise<SubscriptionUser | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.id === appUserId || candidate.appUserAlias === appUserId,
    );
    if (user == null) {
      return null;
    }
    const { appUserAlias: _alias, ...found } = this.#copyUser(user);
    return found;
  }

  async findStoreEntitlements(userId: string): Promise<StoreSubscriptionEntitlement[]> {
    return [...this.subscriptions.values()]
      .filter((record) => record.userId === userId)
      .map((record) => ({
        storeSubscriptionId: record.storeSubscriptionId.value,
        productId: record.productId,
        startedAt: new Date(record.startedAt),
        status: record.status,
        expiresAt: new Date(record.expiresAt),
        periodType: record.periodType,
      }));
  }

  async claimChain(storeSubscriptionId: StoreSubscriptionId, userId: string): Promise<boolean> {
    const record = this.subscriptions.get(storeSubscriptionId.value);
    if (record == null) {
      return false;
    }
    if (record.userId === userId) {
      return false;
    }
    this.subscriptions.set(storeSubscriptionId.value, { ...record, userId });
    return true;
  }

  async takeOverChains(fromUserId: string, toUserId: string): Promise<number> {
    const records = [...this.subscriptions.values()].filter(
      (record) => record.userId === fromUserId,
    );
    for (const record of records) {
      this.subscriptions.set(record.storeSubscriptionId.value, { ...record, userId: toUserId });
    }
    return records.length;
  }

  async findLapsedPremiumUserIds(params: FindLapsedPremiumUsersParams): Promise<string[]> {
    const { afterUserId } = params;
    return this.lapsedPremiumUserIds
      .filter((userId) => afterUserId == null || userId > afterUserId)
      .sort()
      .slice(0, params.limit);
  }

  async findReconcilableByUserId(userId: string): Promise<Subscription[]> {
    return [...this.subscriptions.values()]
      .filter(
        (record) =>
          record.userId === userId && (record.status === "ACTIVE" || record.status === "CANCELLED"),
      )
      .map((record) => Subscription.reconstitute(record));
  }

  async findByStoreSubscriptionId(
    storeSubscriptionId: StoreSubscriptionId,
  ): Promise<Subscription | null> {
    const record = this.subscriptions.get(storeSubscriptionId.value);
    return record ? Subscription.reconstitute(record) : null;
  }

  async create(data: CreateSubscriptionData): Promise<void> {
    this.subscriptions.set(data.storeSubscriptionId.value, {
      ...data,
      provider: "REVENUECAT",
      id: this.subscriptions.size + 1,
      startedAt: new Date(data.startedAt),
      expiresAt: new Date(data.expiresAt),
      gracePeriodEndsAt: null,
      cancelledAt: null,
      lastProcessedEventId: data.lastProcessedEventId ?? null,
      nextProductId: null,
      periodType: data.periodType ?? null,
    });
  }

  async updateStatus(
    storeSubscriptionId: StoreSubscriptionId,
    data: UpdateSubscriptionStatusData,
  ): Promise<void> {
    const record = this.subscriptions.get(storeSubscriptionId.value);
    if (!record) {
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
        reason: `Subscription not found: ${storeSubscriptionId.value}`,
      });
    }
    const cancelledAt = data.cancelledAt === undefined ? record.cancelledAt : data.cancelledAt;
    this.subscriptions.set(storeSubscriptionId.value, {
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
    if (!user) {
      throw new Error("사용자 저장 상태가 없습니다.");
    }
    this.users.set(
      userId,
      this.#copyUser({ ...user, ...pickBy(data, (value) => value !== undefined) }),
    );
  }

  #copyUser(user: StubSubscriptionUser): StubSubscriptionUser {
    return {
      ...user,
      subscriptionExpiresAt:
        user.subscriptionExpiresAt === null ? null : new Date(user.subscriptionExpiresAt),
      profile: user.profile === null ? null : { ...user.profile },
    };
  }
}

/** 웹훅이 예약한 대조를 사용자 순서대로 기록한다. */
export class StubStoreSubscriptionReconcileScheduler implements StoreSubscriptionReconcileSchedulerPort {
  readonly scheduledUserIds: string[] = [];

  async schedule(userId: string): Promise<void> {
    this.scheduledUserIds.push(userId);
  }
}

/** 체인 키별 스토어 상태를 돌려주는 대역. 읽기 실패를 흉내 내려면 failure를 넣는다. */
export class StubStoreSubscriptionStatusReader implements StoreSubscriptionStatusReaderPort {
  readonly states = new Map<string, StoreSubscriptionState>();
  failure: Error | null = null;

  async read(storeSubscriptionIds: readonly string[]): Promise<StoreSubscriptionState[]> {
    if (this.failure != null) {
      throw this.failure;
    }
    return storeSubscriptionIds.flatMap((id) => {
      const state = this.states.get(id);
      return state == null ? [] : [{ ...state }];
    });
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
  readonly failures: Array<{ error: unknown; context: StoreSubscriptionEventFailureContext }> = [];

  notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
    this.events.push(payload);
  }
  async recordBillingIssue(userId: string): Promise<void> {
    this.billingIssueUserIds.push(userId);
  }
  reportWebhookFailure(error: unknown, context: StoreSubscriptionEventFailureContext): void {
    this.failures.push({ error, context });
  }
}

export class StubSubscriptionWebhookLock implements SubscriptionWebhookLockPort {
  readonly heldKeys = new Set<string>();

  async acquire(appUserId: string): Promise<(() => Promise<void>) | null> {
    if (this.heldKeys.has(appUserId)) {
      return null;
    }
    this.heldKeys.add(appUserId);
    return async () => {
      this.heldKeys.delete(appUserId);
    };
  }
}

export class StubSubscriptionReceiptRepository implements SubscriptionEventReceiptRepositoryPort {
  readonly receipts = new Map<string, { eventId: string; eventType: string; processedAt: Date }>();

  async claim(input: ClaimSubscriptionEventReceiptInput): Promise<boolean> {
    if (this.receipts.has(input.eventId)) {
      return false;
    }
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
  "findOpenByUserId" | "findBySourceKey" | "create" | "saveAll"
> {
  readonly grants = new Map<string, PremiumGrantProps>();

  async findBySourceKey(sourceKey: string): Promise<PremiumGrant | null> {
    const grant = [...this.grants.values()].find((candidate) => candidate.sourceKey === sourceKey);
    return grant == null ? null : PremiumGrant.reconstitute(grant);
  }

  async findOpenByUserId(userId: string): Promise<PremiumGrant[]> {
    return [...this.grants.values()]
      .filter(
        (grant) =>
          grant.userId === userId && (grant.status === "BANKED" || grant.status === "ACTIVE"),
      )
      .map((grant) => PremiumGrant.reconstitute(grant));
  }

  async create(plan: PremiumGrantCreationPlan): Promise<boolean> {
    if ([...this.grants.values()].some((grant) => grant.sourceKey === plan.sourceKey)) {
      return false;
    }
    const id = `grant-${this.grants.size + 1}`;
    this.grants.set(id, {
      ...plan,
      durationMs: plan.durationMs ?? null,
      id,
      endingNotifiedAt: null,
      createdAt: plan.createdAt ?? new Date(),
    });
    return true;
  }

  async saveAll(grants: readonly PremiumGrant[]): Promise<void> {
    for (const grant of grants) {
      const current = this.grants.get(grant.id);
      if (current == null) {
        continue;
      }
      this.grants.set(grant.id, { ...current, ...grant.toPersistence() });
    }
  }
}
