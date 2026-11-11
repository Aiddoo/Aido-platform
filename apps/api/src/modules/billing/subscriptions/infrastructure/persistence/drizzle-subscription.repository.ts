import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull, ne } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { subscription } from "#api/platform/database/schema/billing.schema";
import { nextSequenceValue } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { SubscriptionRepositoryPort } from "../../application/ports/subscription.repository.port.js";
import type { StoreSubscriptionId } from "../../domain/store-subscription-id.vo.js";
import { SubscriptionId } from "../../domain/subscription-id.vo.js";
import type { Subscription } from "../../domain/subscription.aggregate.js";
import { toSubscription, toSubscriptionRow } from "./subscription-row.mapper.js";

@Injectable()
export class DrizzleSubscriptionRepository extends SubscriptionRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<SubscriptionId> {
    return SubscriptionId.reconstitute(await nextSequenceValue(this.#db, subscription.id));
  }

  async findByStoreSubscriptionId(
    storeSubscriptionId: StoreSubscriptionId,
  ): Promise<Subscription | null> {
    const row = await this.#db.query.subscription.findFirst({
      where: { revenueCatId: storeSubscriptionId.value },
    });
    return row == null ? null : toSubscription(row);
  }

  async listReconcilableByUserId(userId: UserId): Promise<Subscription[]> {
    const rows = await this.#db.query.subscription.findMany({
      where: {
        userId: userId.value,
        deletedAt: { isNull: true },
        status: { in: ["ACTIVE", "CANCELLED"] },
      },
      orderBy: { id: "asc" },
    });
    return rows.map(toSubscription);
  }

  async existsByUserId(userId: UserId): Promise<boolean> {
    const count = await this.#db.$count(
      subscription,
      and(eq(subscription.userId, userId.value), isNull(subscription.deletedAt)),
    );
    return count > 0;
  }

  async claimChain(
    storeSubscriptionId: StoreSubscriptionId,
    userId: UserId,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const claimed = await this.#db
      .update(subscription)
      .set({ userId: userId.value, updatedAt: now })
      .where(
        and(
          eq(subscription.revenueCatId, storeSubscriptionId.value),
          ne(subscription.userId, userId.value),
        ),
      )
      .returning({ id: subscription.id });
    return claimed.length > 0;
  }

  async takeOverChains(
    fromUserId: UserId,
    toUserId: UserId,
    now: Temporal.Instant,
  ): Promise<number> {
    const taken = await this.#db
      .update(subscription)
      .set({ userId: toUserId.value, updatedAt: now })
      .where(and(eq(subscription.userId, fromUserId.value), isNull(subscription.deletedAt)))
      .returning({ id: subscription.id });
    return taken.length;
  }

  async save(aggregate: Subscription): Promise<void> {
    const row = toSubscriptionRow(aggregate);
    await this.#db
      .insert(subscription)
      .values(row)
      .onConflictDoUpdate({
        target: subscription.id,
        // 소유자·시작 시각·결제 환경·안내 표시는 바꾸지 않는다. 소유자는 claimChain이 옮긴다
        set: {
          productId: row.productId,
          status: row.status,
          expiresAt: row.expiresAt,
          gracePeriodEndsAt: row.gracePeriodEndsAt,
          cancelledAt: row.cancelledAt,
          lastProcessedEventId: row.lastProcessedEventId,
          nextProductId: row.nextProductId,
          periodType: row.periodType,
          updatedAt: row.updatedAt,
        },
      });
  }
}
