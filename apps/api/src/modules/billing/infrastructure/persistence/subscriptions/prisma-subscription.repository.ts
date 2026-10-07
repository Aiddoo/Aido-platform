import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { or } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { varchar } from "#api/platform/database/database-values";
import type * as PrismaModels from "#api/platform/database/database.types";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { isRecordNotFoundError } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type {
  CreateSubscriptionData,
  SubscriptionRepositoryPort,
  SubscriptionUser,
  UpdateSubscriptionStatusData,
  UpdateUserSubscriptionStatusData,
} from "../../../application/ports/subscriptions/subscription.repository.port.js";
import { Subscription } from "../../../domain/aggregates/subscriptions/subscription.aggregate.js";

/**
 * 구독 저장소 Prisma 어댑터.
 *
 * RevenueCat 웹훅으로부터 수신한 구독 이벤트를 DB에 반영한다.
 *
 * 트랜잭션은 CLS로 전파된다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 활성 트랜잭션이 없으면 베이스 DatabaseService를 반환한다.
 */
@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) */
  private get client() {
    return this.txHost.tx;
  }

  /**
   * RevenueCat 거래 ID로 구독 조회
   */
  async findByRevenueCatId(revenueCatId: string): Promise<Subscription | null> {
    const row = decodeRecord(
      "Subscription",
      await this.client.orm.public.Subscription.where((row) =>
        row.revenueCatId.eq(varchar(revenueCatId, 255)),
      ).first(),
    );
    return row ? PrismaSubscriptionRepository.toDomain(row) : null;
  }

  /**
   * RevenueCat appUserId로 사용자 조회
   *
   * revenueCatUserId 또는 id로 사용자를 찾는다. RevenueCat은 최초에 User.id를
   * appUserId로 사용하고, 이후 alias가 설정되면 revenueCatUserId가 다를 수 있다.
   */
  async findUserByAppUserId(appUserId: string): Promise<SubscriptionUser | null> {
    return this.client.orm.public.User.where((row) =>
      or(row.revenueCatUserId.eq(varchar(appUserId, 255)), row.id.eq(appUserId)),
    )
      .select("id", "email", "subscriptionStatus", "subscriptionExpiresAt", "revenueCatUserId")
      .include("profile", (related) => related.select("name"))
      .first()
      .then((row) => decodeRecord("User", row));
  }

  /**
   * 구독 생성 (INITIAL_PURCHASE용)
   */
  async create(data: CreateSubscriptionData): Promise<void> {
    decodeRecord(
      "Subscription",
      await this.client.orm.public.Subscription.create(
        encodeCreate("Subscription", {
          userId: data.userId,
          revenueCatId: data.revenueCatId,
          productId: data.productId,
          status: data.status,
          startedAt: data.startedAt,
          expiresAt: data.expiresAt,
          ...(data.lastProcessedEventId && {
            lastProcessedEventId: data.lastProcessedEventId,
          }),
        }),
      ),
    );
  }

  /**
   * 구독 상태 업데이트
   */
  async updateStatus(revenueCatId: string, data: UpdateSubscriptionStatusData): Promise<void> {
    try {
      decodeRecord(
        "Subscription",
        requireRecord(
          await this.client.orm.public.Subscription.where((row) =>
            row.revenueCatId.eq(varchar(revenueCatId, 255)),
          ).update(encodePatch("Subscription", data)),
        ),
      );
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
          reason: `Subscription not found: ${revenueCatId}`,
        });
      }
      throw error;
    }
  }

  /**
   * User 테이블의 구독 상태 동기화
   */
  async updateUserSubscriptionStatus(
    userId: string,
    data: UpdateUserSubscriptionStatusData,
  ): Promise<void> {
    decodeRecord(
      "User",
      requireRecord(
        await this.client.orm.public.User.where((row) => row.id.eq(userId)).update(
          encodePatch("User", {
            subscriptionStatus: data.subscriptionStatus,
            ...(data.subscriptionExpiresAt !== undefined && {
              subscriptionExpiresAt: data.subscriptionExpiresAt,
            }),
            ...(data.revenueCatUserId !== undefined && {
              revenueCatUserId: data.revenueCatUserId,
            }),
          }),
        ),
      ),
    );
  }

  /** Prisma 행 → Subscription 애그리게잇 */
  private static toDomain(row: PrismaModels.Subscription): Subscription {
    return Subscription.reconstitute({
      id: row.id,
      userId: row.userId,
      revenueCatId: row.revenueCatId,
      productId: row.productId,
      status: row.status,
      startedAt: row.startedAt,
      expiresAt: row.expiresAt,
      cancelledAt: row.cancelledAt,
      lastProcessedEventId: row.lastProcessedEventId,
    });
  }
}
