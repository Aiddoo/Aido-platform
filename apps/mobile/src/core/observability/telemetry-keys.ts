import type { SUBSCRIPTION_STATUS } from '@aido/api/vocabulary';

// 포트가 쓰는 관측 키의 단일 원본. 오류 보고 feature·breadcrumb 카테고리·사용자 속성을 여기서만 정의한다.

/** 오류 보고의 `feature` 값. snake_case만 쓰고 새 값은 여기에 먼저 추가한다. */
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
  'root_error_boundary',
  'share_view_capture',
  'store_review',
  'subscription',
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

/** `captureMessage`로 보내는 이슈 제목. 알림 규칙이 이 값을 볼 수 있어 값을 바꾸지 않는다. */
export const ERROR_REPORT_MESSAGES = {
  AUTH_REFRESH_RETRY_REJECTED: 'auth_refresh_retry_rejected',
  QUERY_BOUNDARY_AUTH_CONTAINED: 'query_boundary_auth_contained',
  SESSION_EXPIRED: 'session_expired',
  SUBSCRIPTION_PURCHASE_FAILED: 'subscription_purchase_failed',
  SUBSCRIPTION_RESTORE_FAILED: 'subscription_restore_failed',
  SUBSCRIPTION_STORE_UNAVAILABLE: 'subscription_store_unavailable',
} as const;
export type ErrorReportMessage = (typeof ERROR_REPORT_MESSAGES)[keyof typeof ERROR_REPORT_MESSAGES];

/**
 * breadcrumb 카테고리(벤더 중립).
 *
 * 이벤트/크래시 직전의 행적을 분류해 대시보드에서 필터할 수 있게 한다.
 * 자유 문자열 대신 union으로 고정해 오탈자·미정의 카테고리를 컴파일 타임에 막는다.
 */
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

/**
 * 개발·프리뷰 빌드의 모든 이벤트(네이티브 자동 수집 포함)에 붙이는 기본 파라미터.
 * GA 데이터 필터 "내부 트래픽"이 `traffic_type = internal`을 수집 시점에 제외한다.
 */
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
