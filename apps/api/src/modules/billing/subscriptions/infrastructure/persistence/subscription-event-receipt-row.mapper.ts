import type { subscriptionEventReceipt as subscriptionEventReceiptTable } from "#api/platform/database/schema/billing.schema";

import type { SubscriptionEventReceipt } from "../../domain/subscription-event-receipt.entity.js";

type SubscriptionEventReceiptInsertRow = typeof subscriptionEventReceiptTable.$inferInsert;

export function toSubscriptionEventReceiptRow(
  receipt: SubscriptionEventReceipt,
): SubscriptionEventReceiptInsertRow {
  return receipt.toPrimitives();
}
