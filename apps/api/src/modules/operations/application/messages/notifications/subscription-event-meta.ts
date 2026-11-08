import type { RevenueCatEventType, RevenueCatStore } from "@aido/api/vocabulary";

import type { SubscriptionLifecycle } from "#api/modules/billing/billing-subscriptions.public";

import type { AdminNotificationSeverity } from "../../read-models/notifications/admin-notification.read-model.js";

/** 관리자 알림에서 사용하는 내부 이벤트 키 */
export type SubscriptionEventKey =
  | "subscription.purchased"
  | "subscription.one_time_purchased"
  | "subscription.renewed"
  | "subscription.cancelled"
  | "subscription.expired"
  | "subscription.billing_issue"
  | "subscription.uncancelled"
  | "subscription.product_changed"
  | "subscription.refunded"
  | "subscription.extended"
  | "subscription.transferred"
  | "subscription.trial_started"
  | "subscription.trial_cancelled"
  | "subscription.trial_converted"
  | "subscription.trial_expired";

/** RevenueCat 이벤트 타입 → 내부 이벤트 키 매핑 */
export const REVENUECAT_EVENT_TO_INTERNAL: Partial<
  Record<RevenueCatEventType, SubscriptionEventKey>
> = {
  INITIAL_PURCHASE: "subscription.purchased",
  RENEWAL: "subscription.renewed",
  CANCELLATION: "subscription.cancelled",
  EXPIRATION: "subscription.expired",
  BILLING_ISSUE: "subscription.billing_issue",
  UNCANCELLATION: "subscription.uncancelled",
  PRODUCT_CHANGE: "subscription.product_changed",
  NON_RENEWING_PURCHASE: "subscription.one_time_purchased",
  SUBSCRIPTION_EXTENDED: "subscription.extended",
  TRANSFER: "subscription.transferred",
};

/** RevenueCat은 환불을 CANCELLATION + cancel_reason=CUSTOMER_SUPPORT로 보낸다. */
export const REFUND_CANCEL_REASON = "CUSTOMER_SUPPORT";

interface EventMeta {
  title: string;
  severity: AdminNotificationSeverity;
  emoji: string;
}

export const EVENT_META: Record<SubscriptionEventKey, EventMeta> = {
  "subscription.purchased": {
    title: "새로운 구독 구매",
    severity: "success",
    emoji: "🎉",
  },
  "subscription.one_time_purchased": {
    title: "일회성 구매",
    severity: "success",
    emoji: "🛒",
  },
  "subscription.renewed": {
    title: "구독 갱신",
    severity: "info",
    emoji: "🔄",
  },
  "subscription.cancelled": {
    title: "구독 취소",
    severity: "critical",
    emoji: "❌",
  },
  "subscription.expired": {
    title: "구독 만료",
    severity: "info",
    emoji: "⏰",
  },
  "subscription.billing_issue": {
    title: "결제 문제 감지",
    severity: "warning",
    emoji: "⚠️",
  },
  "subscription.uncancelled": {
    title: "구독 취소 철회",
    severity: "success",
    emoji: "✅",
  },
  "subscription.product_changed": {
    title: "구독 상품 변경",
    severity: "info",
    emoji: "🔀",
  },
  "subscription.refunded": {
    title: "구독 환불",
    severity: "critical",
    emoji: "↩️",
  },
  "subscription.extended": {
    title: "구독 연장",
    severity: "success",
    emoji: "⏳",
  },
  "subscription.transferred": {
    title: "구독 이전",
    severity: "info",
    emoji: "🔁",
  },
  "subscription.trial_started": {
    title: "무료 체험 시작",
    severity: "success",
    emoji: "🧪",
  },
  "subscription.trial_cancelled": {
    title: "체험 해지 (체험 끝까지 이용)",
    severity: "warning",
    emoji: "⏸️",
  },
  "subscription.trial_converted": {
    title: "체험 → 유료 전환",
    severity: "success",
    emoji: "💰",
  },
  "subscription.trial_expired": {
    title: "체험 종료 (전환 안 됨)",
    severity: "info",
    emoji: "📉",
  },
};

/** billing이 판단한 무료 체험 단계 → 내부 이벤트 키 */
export const LIFECYCLE_EVENT_KEYS = {
  trial_started: "subscription.trial_started",
  trial_cancelled: "subscription.trial_cancelled",
  trial_converted: "subscription.trial_converted",
  trial_expired: "subscription.trial_expired",
} as const satisfies Record<SubscriptionLifecycle, SubscriptionEventKey>;

export const DEFAULT_META: EventMeta = {
  title: "구독 이벤트",
  severity: "info",
  emoji: "📋",
};

/** 샌드박스(테스트 결제)는 이벤트 종류와 무관하게 info로 낮춘다. */
export const SANDBOX_SEVERITY: AdminNotificationSeverity = "info";

/** 이벤트 직후 자동 갱신 상태. 이벤트 자체로 확정할 수 없으면 생략한다. */
export const AUTO_RENEW_LABELS: Partial<Record<SubscriptionEventKey, string>> = {
  "subscription.purchased": "켜짐",
  "subscription.renewed": "켜짐",
  "subscription.uncancelled": "켜짐",
  "subscription.product_changed": "켜짐",
  "subscription.extended": "켜짐",
  "subscription.billing_issue": "켜짐 (결제 재시도 중)",
  "subscription.cancelled": "꺼짐",
  "subscription.refunded": "꺼짐",
  "subscription.expired": "꺼짐",
  "subscription.one_time_purchased": "해당 없음 (일회성)",
  "subscription.trial_started": "켜짐 (체험 끝에 결제)",
  "subscription.trial_cancelled": "꺼짐",
  "subscription.trial_converted": "켜짐",
  "subscription.trial_expired": "꺼짐",
};

export const STORE_LABELS: Partial<Record<RevenueCatStore, string>> = {
  APP_STORE: "Apple App Store",
  MAC_APP_STORE: "Mac App Store",
  PLAY_STORE: "Google Play Store",
  STRIPE: "Stripe",
  RC_BILLING: "RevenueCat Web Billing",
  AMAZON: "Amazon",
  PROMOTIONAL: "Promotional",
};

export const DEVICE_LABELS: Partial<Record<RevenueCatStore, string>> = {
  APP_STORE: "🍎 iOS",
  MAC_APP_STORE: "🍎 macOS",
  PLAY_STORE: "🤖 Android",
  STRIPE: "🌐 Web",
  RC_BILLING: "🌐 Web",
  AMAZON: "📦 Amazon",
  PROMOTIONAL: "🎁 프로모션",
};

/** RevenueCat period_type → 구독 유형 */
export const PERIOD_TYPE_LABELS: Record<string, string> = {
  NORMAL: "일반",
  TRIAL: "무료 체험",
  INTRO: "첫 구매 할인",
  PROMOTIONAL: "프로모션",
  PREPAID: "선불",
};

/** RevenueCat cancel_reason / expiration_reason → 사유 */
export const REASON_LABELS: Record<string, string> = {
  UNSUBSCRIBE: "사용자 해지",
  BILLING_ERROR: "결제 실패",
  DEVELOPER_INITIATED: "개발자 취소",
  PRICE_INCREASE: "가격 인상 미동의",
  CUSTOMER_SUPPORT: "고객지원 환불",
  SUBSCRIPTION_PAUSED: "구독 일시정지",
  UNKNOWN: "알 수 없음",
};

/** 상품 ID에 포함된 기간 키워드 → 표시 라벨 */
export const PRODUCT_PERIOD_LABELS: readonly {
  readonly pattern: RegExp;
  readonly label: string;
}[] = [
  { pattern: /year|annual/i, label: "연간" },
  { pattern: /month/i, label: "월간" },
  { pattern: /week/i, label: "주간" },
];
