import type { PlanType } from '@src/shared/domains/plan-type.model';

import type { SubscriptionView } from '../schemas/subscription-params.schema';
import type {
  PremiumGateAnalyticsFeature,
  PurchaseFailedReason,
} from '../utils/subscription-analytics';
import type { UpsellPresentation } from '../utils/upsell.view-model';

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
  | 'voice_note';

export type PremiumQuickstartAction = 'voice_note' | 'ai_report' | 'app_icon';

export type CheckoutStep = 'status' | 'welcome';

/** precheck: 시작 전에 남은 횟수 0을 보고 막았다 · server: 서버가 한도 오류로 막았다 */
export type LimitReachedTrigger = 'precheck' | 'server';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /**
     * 퍼널 단계일 뿐 매출 집계에 쓰지 않는다(원본은 RevenueCat `purchase`). 대시보드 이력 때문에 이름을 유지한다.
     * 아래 결제 이벤트의 `is_trial`은 스토어가 그 요금제에 무료 체험을 줄 수 있다고 한 것이다(실제 체험 여부는 서버 /me)
     */
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    subscription_started: { product_id: string; plan_type: PlanType; is_trial: boolean };
    subscription_restored: undefined;
    /** 복원이 문의로 안내할 만한 실패로 끝났다. 복원할 구매가 없는 것은 실패가 아니다 */
    subscription_restore_failed: { reason: PurchaseFailedReason };
    /** 스토어의 구독 관리 화면을 열었다 */
    subscription_management_opened: { store: 'app_store' | 'play_store' };
    /** 프리미엄 안내를 띄웠다. 같은 기능을 그날 이미 닫았으면 toast다 */
    premium_gate_shown: {
      feature: PremiumGateAnalyticsFeature;
      surface: EntitlementGateSurface;
      presentation: UpsellPresentation;
    };
    /** 안내 시트·토스트에서 프리미엄 보기를 눌렀다 */
    premium_gate_cta_tapped: {
      feature: PremiumGateAnalyticsFeature;
      surface: EntitlementGateSurface;
      presentation: UpsellPresentation;
    };
    /** 시트를 프리미엄 보기·대안 동작 없이 닫았다(나중에·밀어 닫기). 그날 같은 기능은 토스트로 바뀐다 */
    premium_upsell_dismissed: {
      feature: PremiumGateAnalyticsFeature;
      surface: EntitlementGateSurface;
    };
    /** 요금제를 받아 페이월을 보여 줬다. `plans`는 보상 기간 영수증에서 요금제로 넘어온 경우, `feature`는 막혀서 들어온 기능이다 */
    paywall_viewed: { view: SubscriptionView; feature?: PremiumGateAnalyticsFeature };
    /** 사용자가 고른 요금제를 바꿨다. 처음 골라 둔 연간은 세지 않는다 */
    paywall_plan_selected: { plan_type: PlanType; is_trial: boolean };
    /** 구독 화면의 단계를 보였다. 결제 뒤 시작 화면까지 가는 비율을 본다 */
    checkout_step_viewed: { step: CheckoutStep };
    /** 결제 직후 시작 화면에서 바로 해 볼 기능을 눌렀다 */
    premium_quickstart_tapped: { action: PremiumQuickstartAction };
    /** 페이월 혜택 장을 보였다. `index`는 "혜택 N" 칩 번호(1부터)이고 페이월마다 장별로 한 번이다 */
    paywall_benefit_viewed: { feature: PremiumGateAnalyticsFeature; index: number };
    /** 비교표에서 기능 이름을 눌러 설명을 열었다 */
    plan_comparison_term_opened: { feature: PremiumGateAnalyticsFeature };
    /** 체험 일정을 페이월에서 처음 보여 줬다. 요금제를 오가도 페이월마다 한 번이다 */
    trial_timeline_viewed: { plan_type: PlanType };
    /** 문의로 안내한 결제 실패. 직접 취소·승인 대기는 세지 않는다 */
    purchase_failed: { reason: PurchaseFailedReason; plan_type: PlanType; is_trial: boolean };
    /** 스토어 결제 창에서 직접 취소했다 */
    purchase_cancelled: { plan_type: PlanType; is_trial: boolean };
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
