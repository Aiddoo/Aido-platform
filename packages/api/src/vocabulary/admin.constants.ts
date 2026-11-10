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
  ALL: "ALL",
  WITH_PUSH_TOKEN: "WITH_PUSH_TOKEN",
  ACTIVE_LAST_7_DAYS: "ACTIVE_LAST_7_DAYS",
  ACTIVE_LAST_30_DAYS: "ACTIVE_LAST_30_DAYS",
  SUBSCRIBERS: "SUBSCRIBERS",
} as const;

export type BroadcastTargetFilter =
  (typeof BROADCAST_TARGET_FILTER)[keyof typeof BROADCAST_TARGET_FILTER];

/** 브로드캐스트 발송 시점. NOW는 접수 직후, RECIPIENT_LOCAL_TIME은 수신자 현지 날짜·시각이다. */
export const BROADCAST_DELIVERY_MODES = ["NOW", "RECIPIENT_LOCAL_TIME"] as const;

export type BroadcastDeliveryMode = (typeof BROADCAST_DELIVERY_MODES)[number];

/**
 * 브로드캐스트 캠페인 진행 상태
 *
 * - QUEUED: 접수했고 대상 분배 작업을 기다린다
 * - FANNING_OUT: 대상 사용자에게 알림을 나눠 만드는 중이다
 * - COMPLETED: 모든 대상에게 알림을 만들고 발송 대기열에 올렸다
 * - FAILED: 분배 작업이 재시도를 다 쓰고 멈췄다
 */
export const BROADCAST_CAMPAIGN_STATUS = {
  QUEUED: "QUEUED",
  FANNING_OUT: "FANNING_OUT",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type BroadcastCampaignStatus =
  (typeof BROADCAST_CAMPAIGN_STATUS)[keyof typeof BROADCAST_CAMPAIGN_STATUS];
