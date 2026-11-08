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

/** precheck: 시작 전에 남은 횟수 0을 보고 막았다 · server: 서버가 한도 오류로 막았다 */
export type LimitReachedTrigger = 'precheck' | 'server';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /**
     * 앱에서 결제가 끝난 순간(UI·퍼널 단계). **매출·전환 집계에 쓰지 않는다** — 매출 원본은 RevenueCat `purchase`다.
     * 대시보드 이력을 지키려고 이름은 유지한다.
     */
    subscription_started: { product_id: string };
    subscription_restored: undefined;
    premium_gate_shown: { feature: PremiumGateAnalyticsFeature; surface: EntitlementGateSurface };
    /** 게이트 다이얼로그에서 구독하기를 눌렀다 */
    premium_gate_cta_tapped: {
      feature: PremiumGateAnalyticsFeature;
      surface: EntitlementGateSurface;
    };
    /** 요금제를 받아 페이월을 보여 줬다. `plans`는 보상 기간 영수증에서 요금제로 넘어온 경우다 */
    paywall_viewed: { view: SubscriptionView };
    /** 문의로 안내한 결제 실패. 직접 취소·승인 대기는 세지 않는다 */
    purchase_failed: { reason: PurchaseFailedReason };
    /** 횟수·개수 한도에 닿아 안내를 띄웠다(premium_gate_shown과 함께 남는다) */
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
