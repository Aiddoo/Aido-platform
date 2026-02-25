/**
 * 알려진 RevenueCat 이벤트 타입 (코드 참조 및 switch문용)
 *
 * RevenueCat은 새 이벤트 타입을 추가할 수 있으므로,
 * Zod 스키마에서는 z.string()으로 수용하고 여기서는 참조용으로만 사용합니다.
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export const REVENUECAT_EVENT_TYPES = [
  'TEST',
  'INITIAL_PURCHASE',
  'NON_RENEWING_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIBER_ALIAS',
  'SUBSCRIPTION_PAUSED',
  'SUBSCRIPTION_EXTENDED',
  'TRANSFER',
  'EXPIRATION',
  'TEMPORARY_ENTITLEMENT_GRANT',
] as const;

/** 알려진 이벤트 타입 유니온 (switch문 참조용). 실제 webhook은 이 외의 타입도 수신 가능. */
export type RevenueCatEventType = (typeof REVENUECAT_EVENT_TYPES)[number] | (string & {});

/**
 * 알려진 RevenueCat 스토어 (코드 참조용)
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export const REVENUECAT_STORES = [
  'APP_STORE',
  'MAC_APP_STORE',
  'PLAY_STORE',
  'AMAZON',
  'STRIPE',
  'RC_BILLING',
  'PROMOTIONAL',
] as const;

/** 알려진 스토어 유니온 (참조용). 실제 webhook은 이 외의 스토어도 수신 가능. */
export type RevenueCatStore = (typeof REVENUECAT_STORES)[number] | (string & {});
