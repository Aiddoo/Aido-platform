import type { RevenueCatWebhookPayload } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook.wire";

type SubscriptionEvent = RevenueCatWebhookPayload["event"];

const SUBSCRIPTION_EVENT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const EXPIRED_EVENT_OFFSET_MS = 1000;

function randomSuffix(): string {
  return crypto.randomUUID().slice(0, 8);
}

// 이벤트 종류마다 RevenueCat이 늘 채우는 칸을 기본값으로 둔다
function defaultsOf(type: string, nowMs: number): Partial<SubscriptionEvent> {
  if (type === "CANCELLATION") {
    return { cancel_reason: "UNSUBSCRIBE" };
  }
  if (type === "EXPIRATION") {
    return { expiration_at_ms: nowMs - EXPIRED_EVENT_OFFSET_MS };
  }
  return {};
}

export function createSubscriptionEventFixture(
  type: string,
  overrides: Partial<SubscriptionEvent> = {},
): RevenueCatWebhookPayload {
  const nowMs = Date.now();
  return {
    api_version: "4.0.0",
    event: {
      id: `evt-${randomSuffix()}`,
      type,
      app_user_id: `user-${randomSuffix()}`,
      product_id: "premium_monthly",
      store: "APP_STORE",
      environment: "PRODUCTION",
      transaction_id: `txn-${randomSuffix()}`,
      original_transaction_id: `otxn-${randomSuffix()}`,
      purchased_at_ms: nowMs,
      expiration_at_ms: nowMs + SUBSCRIPTION_EVENT_PERIOD_MS,
      ...defaultsOf(type, nowMs),
      ...overrides,
    },
  };
}
