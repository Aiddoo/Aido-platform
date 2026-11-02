import type { PremiumFeature } from '@aido/api';

/**
 * premium_gate_shown.feature로 보내는 값. 서버 카탈로그 전부터 대시보드가 이 이름으로 집계해 왔으므로 바꾸지 않는다.
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
} as const satisfies Record<PremiumFeature, string>;

export type PremiumGateAnalyticsFeature = (typeof PREMIUM_GATE_ANALYTICS_FEATURE)[PremiumFeature];

export function toPremiumGateAnalyticsFeature(
  feature: PremiumFeature,
): PremiumGateAnalyticsFeature {
  return PREMIUM_GATE_ANALYTICS_FEATURE[feature];
}
