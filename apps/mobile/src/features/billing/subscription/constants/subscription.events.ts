import type { SubscriptionView } from '../schemas/subscription-params.schema';
import type {
  PremiumGateAnalyticsFeature,
  PurchaseFailedReason,
} from '../utils/subscription-analytics';

export type EntitlementGateSurface =
  | 'add_todo_sheet'
  | 'memo_detail'
  | 'category_create'
  | 'friend_request'
  | 'poke_banner'
  | 'todo_nudge'
  | 'suggestions'
  | 'notification_center'
  | 'app_icon_settings'
  | 'reminder_settings'
  | 'report_detail'
  | 'voice_note';

export type LimitReachedTrigger = 'precheck' | 'server';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    // 매출·전환 집계에 쓰지 않는다. 매출 원본은 RevenueCat purchase이고 이름은 대시보드 이력 때문에 유지한다
    subscription_started: { product_id: string };
    subscription_restored: undefined;
    premium_gate_shown: { feature: PremiumGateAnalyticsFeature; surface: EntitlementGateSurface };
    premium_gate_cta_tapped: {
      feature: PremiumGateAnalyticsFeature;
      surface: EntitlementGateSurface;
    };
    paywall_viewed: { view: SubscriptionView };
    // 직접 취소·승인 대기는 세지 않는다
    purchase_failed: { reason: PurchaseFailedReason };
    limit_reached_shown: {
      feature: PremiumGateAnalyticsFeature;
      surface: EntitlementGateSurface;
      trigger: LimitReachedTrigger;
    };
    limit_reached_cta_tapped: {
      feature: PremiumGateAnalyticsFeature;
      surface: EntitlementGateSurface;
    };
  }
}
