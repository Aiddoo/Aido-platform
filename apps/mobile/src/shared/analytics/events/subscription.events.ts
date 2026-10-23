/** 프리미엄 안내를 띄운 기능. 대시보드 집계 값이므로 이름을 바꾸지 않는다. */
export type PremiumGateFeature =
  | 'ai_parse'
  | 'ai_report'
  | 'ai_suggestion'
  | 'app_icon'
  | 'friend_limit'
  | 'friend_todo_view'
  | 'nudge_limit'
  | 'reminder_time';

export interface SubscriptionEventMap {
  subscription_started: { product_id: string };
  subscription_restored: undefined;
  premium_gate_shown: { feature: PremiumGateFeature };
}
