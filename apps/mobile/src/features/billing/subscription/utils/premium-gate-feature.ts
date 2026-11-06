import type { EntitlementFeature } from '../schemas/entitlement.schema';

/**
 * premium_gate_*·limit_reached_*의 feature 값. 서버 카탈로그 전부터 대시보드가 이 이름으로 집계해 왔으므로 바꾸지 않는다.
 * 새 기능은 snake_case 이름을 하나 정해 더한다.
 */
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
