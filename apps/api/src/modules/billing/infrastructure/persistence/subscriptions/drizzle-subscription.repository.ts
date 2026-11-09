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

/**
 * 구독 저장소 Drizzle 어댑터.
 *
 * RevenueCat 웹훅으로부터 수신한 구독 이벤트를 DB에 반영한다.
 *
 * 트랜잭션은 CLS로 전파된다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 활성 트랜잭션이 없으면 베이스 클라이언트를 반환한다.
 */
@Injectable()
export class DrizzleSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  /**
   * RevenueCat 거래 ID로 구독 조회
   */
  async findByRevenueCatId(revenueCatId: string): Promise<Subscription | null> {
    const row = await this.db.query.subscription.findFirst({
      columns: {
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
        periodType: true,
      },
      where: { revenueCatId },
    });
    return row == null
      ? null
      : Subscription.reconstitute({ ...row, periodType: toStorePeriodType(row.periodType) });
  }

  /**
   * RevenueCat appUserId로 사용자 조회
   *
   * revenueCatUserId 또는 id로 사용자를 찾는다. RevenueCat은 최초에 User.id를
   * appUserId로 사용하고, 이후 alias가 설정되면 revenueCatUserId가 다를 수 있다.
   */
  async findUserByAppUserId(appUserId: string): Promise<SubscriptionUser | null> {
    const row = await this.db.query.user.findFirst({
      columns: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        revenueCatUserId: true,
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
        status: true,
        expiresAt: true,
        gracePeriodEndsAt: true,
        periodType: true,
      },
      where: { userId, deletedAt: { isNull: true } },
    });
    return rows.map((row) => ({ ...row, periodType: toStorePeriodType(row.periodType) }));
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

  /**
   * 구독 생성 (INITIAL_PURCHASE용)
   */
  async create(data: CreateSubscriptionData): Promise<void> {
    await this.db.insert(subscription).values({
      userId: data.userId,
      revenueCatId: data.revenueCatId,
      productId: data.productId,
      status: data.status,
      startedAt: data.startedAt,
      expiresAt: data.expiresAt,
      lastProcessedEventId: data.lastProcessedEventId,
      environment: data.environment,
      periodType: data.periodType,
    });
  }

  /**
   * 구독 상태 업데이트
   */
  async updateStatus(revenueCatId: string, data: UpdateSubscriptionStatusData): Promise<void> {
    const updated = await this.db
      .update(subscription)
      .set(data)
      .where(eq(subscription.revenueCatId, revenueCatId))
      .returning({ id: subscription.id });
    if (updated.length === 0) {
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
        reason: `Subscription not found: ${revenueCatId}`,
      });
    }
  }

  async claimChain(revenueCatId: string, userId: string): Promise<boolean> {
    const claimed = await this.db
      .update(subscription)
      .set({ userId })
      .where(and(eq(subscription.revenueCatId, revenueCatId), ne(subscription.userId, userId)))
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
        revenueCatUserId: data.revenueCatUserId,
      })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (updated.length === 0) {
      throw new DatabaseRecordNotFoundError();
    }
  }
}
