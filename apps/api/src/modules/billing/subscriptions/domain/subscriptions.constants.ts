/** 구독 결제를 알려 주는 공급자. 두 번째 공급자가 생기면 값을 더한다. */
const SUBSCRIPTION_PROVIDERS = ["REVENUECAT"] as const;

export type SubscriptionProvider = (typeof SUBSCRIPTION_PROVIDERS)[number];

const SUBSCRIPTION_STORES = [
  "APP_STORE",
  "MAC_APP_STORE",
  "PLAY_STORE",
  "STRIPE",
  "WEB_BILLING",
  "AMAZON",
  "PROMOTIONAL",
] as const;

export type SubscriptionStore = (typeof SUBSCRIPTION_STORES)[number];

export const SUBSCRIPTION_END_REASONS = [
  "UNSUBSCRIBE",
  "BILLING_ERROR",
  "DEVELOPER_INITIATED",
  "PRICE_INCREASE",
  "CUSTOMER_SUPPORT",
  "SUBSCRIPTION_PAUSED",
  "UNKNOWN",
] as const;

export type SubscriptionEndReason = (typeof SUBSCRIPTION_END_REASONS)[number];

/**
 * 스토어 구독에 일어난 일. 공급자 이벤트 이름을 모른다. IGNORED는 처리하지 않는 공급자 이벤트다.
 */
const STORE_SUBSCRIPTION_EVENT_KINDS = [
  "STARTED",
  "RENEWED",
  "CANCELLED",
  "UNCANCELLED",
  "EXPIRED",
  "REFUNDED",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE_SCHEDULED",
  "EXTENDED",
  "TRANSFERRED",
  "IGNORED",
] as const;

export type StoreSubscriptionEventKind = (typeof STORE_SUBSCRIPTION_EVENT_KINDS)[number];
