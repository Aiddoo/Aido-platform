export const REVENUECAT_EVENT_TYPES = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'UNCANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE_DETECTED',
  'SUBSCRIBER_ALIAS',
  'PRODUCT_CHANGE',
  'TRANSFER',
] as const;

export type RevenueCatEventType = (typeof REVENUECAT_EVENT_TYPES)[number];

export const REVENUECAT_STORES = [
  'APP_STORE',
  'PLAY_STORE',
  'STRIPE',
  'AMAZON',
  'MAC_APP_STORE',
  'PROMOTIONAL',
] as const;

export type RevenueCatStore = (typeof REVENUECAT_STORES)[number];
