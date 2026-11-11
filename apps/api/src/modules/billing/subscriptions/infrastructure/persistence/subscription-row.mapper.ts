import type { subscription as subscriptionTable } from "#api/platform/database/schema/billing.schema";

import { toStorePeriodType } from "../../domain/subscription-lifecycle.domain-service.js";
import { Subscription } from "../../domain/subscription.aggregate.js";

type SubscriptionRow = typeof subscriptionTable.$inferSelect;
type SubscriptionInsertRow = typeof subscriptionTable.$inferInsert;

// 칼럼 이름 revenueCatId는 운영 DB 계약이라 그대로 두고 도메인에서는 공급자 중립 이름으로 읽는다
export function toSubscription(row: SubscriptionRow): Subscription {
  return Subscription.reconstitute({
    id: row.id,
    userId: row.userId,
    provider: "REVENUECAT",
    storeSubscriptionId: row.revenueCatId,
    productId: row.productId,
    status: row.status,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    gracePeriodEndsAt: row.gracePeriodEndsAt,
    cancelledAt: row.cancelledAt,
    lastProcessedEventId: row.lastProcessedEventId,
    nextProductId: row.nextProductId,
    periodType: toStorePeriodType(row.periodType),
    environment: row.environment,
    updatedAt: row.updatedAt,
  });
}

export function toSubscriptionRow(subscription: Subscription): SubscriptionInsertRow {
  const primitives = subscription.toPrimitives();
  return {
    id: primitives.id,
    userId: primitives.userId,
    revenueCatId: primitives.storeSubscriptionId,
    productId: primitives.productId,
    status: primitives.status,
    startedAt: primitives.startedAt,
    expiresAt: primitives.expiresAt,
    gracePeriodEndsAt: primitives.gracePeriodEndsAt,
    cancelledAt: primitives.cancelledAt,
    lastProcessedEventId: primitives.lastProcessedEventId,
    nextProductId: primitives.nextProductId,
    periodType: primitives.periodType,
    environment: primitives.environment,
    updatedAt: primitives.updatedAt,
  };
}
