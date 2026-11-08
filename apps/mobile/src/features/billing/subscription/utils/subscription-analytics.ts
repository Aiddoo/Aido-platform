import { type EntitlementFeature } from '../domains/entitlement.model';
import type { SubscriptionFailureCause } from '../domains/subscription-failure.model';

// 서버 카탈로그 전부터 대시보드가 이 이름으로 집계해 왔으므로 바꾸지 않는다
const PREMIUM_GATE_ANALYTICS_FEATURE = {
  AI_PARSE: 'ai_parse',
  CHEER: 'cheer_limit',
  NUDGE: 'nudge_limit',
  FRIEND: 'friend_limit',
  TODO_CATEGORY: 'category_limit',
  AI_REPORT: 'ai_report',
  AI_SUGGESTION: 'ai_suggestion',
  CUSTOM_REMINDER_TIME: 'reminder_time',
  APP_ICON: 'app_icon',
  VOICE_NOTE: 'voice_note',
} as const satisfies Record<EntitlementFeature, string>;

export type PremiumGateAnalyticsFeature =
  (typeof PREMIUM_GATE_ANALYTICS_FEATURE)[EntitlementFeature];

export function getPremiumGateAnalyticsFeature(
  feature: EntitlementFeature,
): PremiumGateAnalyticsFeature {
  return PREMIUM_GATE_ANALYTICS_FEATURE[feature];
}

export type PurchaseFailedReason = 'network' | 'server' | 'store_unavailable' | 'store_error';

const PURCHASE_FAILED_REASONS = {
  network: 'network',
  server: 'server',
  store: 'store_unavailable',
  purchaseFailed: 'store_error',
  restoreFailed: 'store_error',
  purchaseCancelled: null,
  paymentPending: null,
} as const satisfies Record<SubscriptionFailureCause, PurchaseFailedReason | null>;

export function toPurchaseFailedReason(
  cause: SubscriptionFailureCause,
): PurchaseFailedReason | null {
  return PURCHASE_FAILED_REASONS[cause];
}
