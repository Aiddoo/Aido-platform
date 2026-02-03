/**
 * Admin 도메인 상수
 */

/**
 * 브로드캐스트 알림 대상 필터
 *
 * - ALL: 모든 활성 사용자
 * - WITH_PUSH_TOKEN: 푸시 토큰이 등록된 사용자
 * - ACTIVE_LAST_7_DAYS: 최근 7일 내 로그인한 사용자
 * - ACTIVE_LAST_30_DAYS: 최근 30일 내 로그인한 사용자
 * - SUBSCRIBERS: 유료 구독 사용자
 */
export const BROADCAST_TARGET_FILTER = {
  ALL: 'ALL',
  WITH_PUSH_TOKEN: 'WITH_PUSH_TOKEN',
  ACTIVE_LAST_7_DAYS: 'ACTIVE_LAST_7_DAYS',
  ACTIVE_LAST_30_DAYS: 'ACTIVE_LAST_30_DAYS',
  SUBSCRIBERS: 'SUBSCRIBERS',
} as const;

export type BroadcastTargetFilter =
  (typeof BROADCAST_TARGET_FILTER)[keyof typeof BROADCAST_TARGET_FILTER];

export const BROADCAST_TARGET_FILTERS = Object.values(BROADCAST_TARGET_FILTER) as [
  BroadcastTargetFilter,
  ...BroadcastTargetFilter[],
];
