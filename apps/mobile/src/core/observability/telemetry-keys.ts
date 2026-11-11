import type { SUBSCRIPTION_STATUS } from '@aido/api/vocabulary';

// 포트가 쓰는 관측 키의 단일 원본. 오류 보고 feature·breadcrumb 카테고리·사용자 속성을 여기서만 정의한다.

export const ERROR_REPORT_FEATURES = [
  'accessibility',
  'ai',
  'app_icon',
  'app_settings',
  'app_version',
  'auth',
  'auth_cold_start',
  'draft',
  'entitlement',
  'env',
  'error_boundary',
  'event_channel',
  'feature_attribution',
  'feature_discovery',
  'firebase_analytics',
  'friend',
  'inquiry',
  'invite',
  'lifecycle',
  'memo',
  'network_status',
  'notification',
  'query_cache',
  'report',
  'root_error_boundary',
  'share_view_capture',
  'store_review',
  'subscription',
  'suggestion',
  'support_mail',
  'todo',
  'todo_comment',
  'todo_nudge',
  'token_refresher',
  'user',
  'voice',
  'weather',
  'weather_location',
  'web_browser',
  'widget',
] as const;
export type ErrorReportFeature = (typeof ERROR_REPORT_FEATURES)[number];

/** 알림 규칙이 이 값을 볼 수 있어 값을 바꾸지 않는다 */
export const ERROR_REPORT_MESSAGES = {
  AUTH_REFRESH_RETRY_REJECTED: 'auth_refresh_retry_rejected',
  QUERY_BOUNDARY_AUTH_CONTAINED: 'query_boundary_auth_contained',
  SESSION_EXPIRED: 'session_expired',
  SUBSCRIPTION_PURCHASE_FAILED: 'subscription_purchase_failed',
  SUBSCRIPTION_RESTORE_FAILED: 'subscription_restore_failed',
  SUBSCRIPTION_STORE_UNAVAILABLE: 'subscription_store_unavailable',
} as const;
export type ErrorReportMessage = (typeof ERROR_REPORT_MESSAGES)[keyof typeof ERROR_REPORT_MESSAGES];

const BREADCRUMB_CATEGORIES = [
  'http',
  'navigation',
  'auth',
  'lifecycle',
  'ui',
  'widget',
  'invite',
  'network',
  'voice',
  'error',
] as const;
export type BreadcrumbCategory = (typeof BREADCRUMB_CATEGORIES)[number];

/** GA 데이터 필터 "내부 트래픽"이 `traffic_type = internal`을 수집 시점에 제외한다 */
export const INTERNAL_TRAFFIC_EVENT_PARAMETERS = { traffic_type: 'internal' } as const;

/** 프리미엄 출처. `is_premium`은 ADMIN·보상 기간(GRANT)을 포함하므로 유료 전환은 `store`로만 센다 */
export type PremiumSourceProperty = 'store' | 'grant' | 'admin' | 'none';

/** 분석 사용자 속성. 이름·값은 GA 커스텀 측정기준이므로 바꾸지 않는다 */
export interface UserPropertyMap {
  is_premium: boolean;
  subscription_status: (typeof SUBSCRIPTION_STATUS)[number];
  premium_source: PremiumSourceProperty;
}

/** 로그아웃 시 다음 계정에 속성이 남지 않도록 모든 사용자 속성을 지우는 값 */
export const CLEARED_USER_PROPERTIES = {
  is_premium: null,
  subscription_status: null,
  premium_source: null,
} as const satisfies Record<keyof UserPropertyMap, null>;

/**
 * GA 예약 구매 이벤트. 매출 원본은 RevenueCat이 Firebase로 보내는 `purchase`이고,
 * Firebase가 스토어 결제를 자동 수집하는 `in_app_purchase`도 있으므로 앱은 이 이름을 쓰지 않는다.
 */
export type GaReservedPurchaseEventName = 'purchase' | 'in_app_purchase' | 'refund';
