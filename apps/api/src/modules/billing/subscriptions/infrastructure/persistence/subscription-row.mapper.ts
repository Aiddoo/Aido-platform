import type { subscription as subscriptionTable } from "#api/platform/database/schema/billing.schema";

import { toStorePeriodType } from "../../../shared/domain/store-period-type.domain-service.js";
import { Subscription } from "../../domain/subscription.aggregate.js";

type SubscriptionRow = typeof subscriptionTable.$inferSelect;
type SubscriptionInsertRow = typeof subscriptionTable.$inferInsert;

export function toSubscription(row: SubscriptionRow): Subscription {
  return Subscription.reconstitute({
    id: row.id,
    userId: row.userId,
    provider: "REVENUECAT",
    storeSubscriptionId: row.storeSubscriptionId,
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
    storeSubscriptionId: primitives.storeSubscriptionId,
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
