import type { RevenueCatWebhookPayload } from "@aido/api";

import type { SubscriptionUser } from "../../ports/subscriptions/subscription.repository.port.js";
import type { SubscriptionEventPayload } from "../../types/subscriptions/subscription-event.payload.js";

type RevenueCatEvent = RevenueCatWebhookPayload["event"];

export function baseEventPayload(
  user: SubscriptionUser,
  event: RevenueCatEvent,
  transactionId?: string,
): SubscriptionEventPayload {
  return {
    userId: user.id,
    email: user.email,
    name: user.profile?.name ?? undefined,
    eventType: event.type,
    productId: event.product_id,
    store: event.store,
    ...(transactionId !== undefined && { transactionId }),
  };
}
