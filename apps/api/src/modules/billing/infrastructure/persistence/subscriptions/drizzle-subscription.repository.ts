import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, ne, not } from "drizzle-orm";

import { activeSubscriptionCondition } from "#api/modules/access/access-entitlement-sql.public";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { subscription, user } from "#api/platform/database/schema/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type {
  CreateSubscriptionData,
  FindLapsedPremiumUsersParams,
  SubscriptionRepositoryPort,
  SubscriptionUser,
  UpdateSubscriptionStatusData,
  UpdateUserSubscriptionStatusData,
} from "../../../application/ports/subscriptions/subscription.repository.port.js";
import { Subscription } from "../../../domain/aggregates/subscriptions/subscription.aggregate.js";
import type { StoreSubscriptionEntitlement } from "../../../domain/policies/subscriptions/premium-access.policy.js";
import { toStorePeriodType } from "../../../domain/policies/subscriptions/subscription-lifecycle.policy.js";
import { StoreSubscriptionId } from "../../../domain/value-objects/subscriptions/store-subscription-id.vo.js";

const SUBSCRIPTION_COLUMNS = {
  id: true,
  userId: true,
  revenueCatId: true,
  productId: true,
  status: true,
  startedAt: true,
  expiresAt: true,
  gracePeriodEndsAt: true,
  cancelledAt: true,
  lastProcessedEventId: true,
  nextProductId: true,
  periodType: true,
} as const;

type SubscriptionRow = Pick<typeof subscription.$inferSelect, keyof typeof SUBSCRIPTION_COLUMNS>;

// 칼럼 이름 revenueCatId는 운영 DB 계약이라 그대로 두고 도메인에서는 공급자 중립 이름으로 읽는다
function toSubscription({ revenueCatId, periodType, ...row }: SubscriptionRow): Subscription {
  return Subscription.reconstitute({
    ...row,
    provider: "REVENUECAT",
    storeSubscriptionId: StoreSubscriptionId.from(revenueCatId),
    periodType: toStorePeriodType(periodType),
  });
}

@Injectable()
export class DrizzleSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findByStoreSubscriptionId(
    storeSubscriptionId: StoreSubscriptionId,
  ): Promise<Subscription | null> {
    const row = await this.db.query.subscription.findFirst({
      columns: SUBSCRIPTION_COLUMNS,
      where: { revenueCatId: storeSubscriptionId.value },
    });
    return row == null ? null : toSubscription(row);
  }

  async findReconcilableByUserId(userId: string): Promise<Subscription[]> {
    const rows = await this.db.query.subscription.findMany({
      columns: SUBSCRIPTION_COLUMNS,
      where: { userId, deletedAt: { isNull: true }, status: { in: ["ACTIVE", "CANCELLED"] } },
      orderBy: { id: "asc" },
    });
    return rows.map(toSubscription);
  }

  // RevenueCat은 처음에 User.id를 appUserId로 쓰고, 별칭이 생기면 revenueCatUserId가 달라진다
  async findUserByAppUserId(appUserId: string): Promise<SubscriptionUser | null> {
    const row = await this.db.query.user.findFirst({
      columns: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
      where: { OR: [{ revenueCatUserId: appUserId }, { id: appUserId }] },
      with: { profile: { columns: { name: true } } },
    });
    return row ?? null;
  }

  async findStoreEntitlements(userId: string): Promise<StoreSubscriptionEntitlement[]> {
    const rows = await this.db.query.subscription.findMany({
      columns: {
        revenueCatId: true,
        productId: true,
        startedAt: true,
        status: true,
        expiresAt: true,
        gracePeriodEndsAt: true,
        periodType: true,
      },
      where: { userId, deletedAt: { isNull: true } },
    });
    return rows.map(({ revenueCatId, ...row }) => ({
      ...row,
      storeSubscriptionId: revenueCatId,
      periodType: toStorePeriodType(row.periodType),
    }));
  }

  async findLapsedPremiumUserIds(params: FindLapsedPremiumUsersParams): Promise<string[]> {
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          eq(user.subscriptionStatus, "ACTIVE"),
          isNull(user.deletedAt),
          not(activeSubscriptionCondition(user, params.now)),
          params.afterUserId == null ? undefined : gt(user.id, params.afterUserId),
        ),
      )
      .orderBy(user.id)
      .limit(params.limit);
    return rows.map((row) => row.id);
  }

  async create(data: CreateSubscriptionData): Promise<void> {
    await this.db.insert(subscription).values({
      userId: data.userId,
      revenueCatId: data.storeSubscriptionId.value,
      productId: data.productId,
      status: data.status,
      startedAt: data.startedAt,
      expiresAt: data.expiresAt,
      lastProcessedEventId: data.lastProcessedEventId,
      environment: data.environment,
      periodType: data.periodType,
    });
  }

  async updateStatus(
    storeSubscriptionId: StoreSubscriptionId,
    data: UpdateSubscriptionStatusData,
  ): Promise<void> {
    const updated = await this.db
      .update(subscription)
      .set(data)
      .where(eq(subscription.revenueCatId, storeSubscriptionId.value))
      .returning({ id: subscription.id });
    if (updated.length === 0) {
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
        reason: `Subscription not found: ${storeSubscriptionId.value}`,
      });
    }
  }

  async claimChain(storeSubscriptionId: StoreSubscriptionId, userId: string): Promise<boolean> {
    const claimed = await this.db
      .update(subscription)
      .set({ userId })
      .where(
        and(
          eq(subscription.revenueCatId, storeSubscriptionId.value),
          ne(subscription.userId, userId),
        ),
      )
      .returning({ id: subscription.id });
    return claimed.length > 0;
  }

  async takeOverChains(fromUserId: string, toUserId: string): Promise<number> {
    const taken = await this.db
      .update(subscription)
      .set({ userId: toUserId })
      .where(and(eq(subscription.userId, fromUserId), isNull(subscription.deletedAt)))
      .returning({ id: subscription.id });
    return taken.length;
  }

  /**
   * User 테이블의 구독 상태 동기화
   */
  async updateUserSubscriptionStatus(
    userId: string,
    data: UpdateUserSubscriptionStatusData,
  ): Promise<void> {
    const updated = await this.db
      .update(user)
      .set({
        subscriptionStatus: data.subscriptionStatus,
        subscriptionExpiresAt: data.subscriptionExpiresAt,
      })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (updated.length === 0) {
      throw new DatabaseRecordNotFoundError();
    }
  }
}
