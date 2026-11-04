/** 월간 quota 기간은 출시 앱 AI 사용량(/v1/ai/usage)과 같은 KST 달력 월이다. 계약이라 바꾸지 않는다. */
export const QUOTA_TIMEZONE = "Asia/Seoul";

/** 사용자 행동 한 번이 쓰는 횟수 */
export const QUOTA_CHARGE_AMOUNT = 1;

/**
 * 같은 키의 RESERVED가 이 시간보다 오래되면 처리하던 요청이 끝내 응답하지 못한 것으로 보고 이어받는다.
 * 가장 긴 AI 작업 제한 시간(수십 초)보다 넉넉하게 둔다.
 */
export const QUOTA_RESERVATION_TAKEOVER_AFTER_MS = 120_000;

/** RESERVED가 이 시간을 넘게 남아 있으면 정리 잡이 돌지 못한 것이라 사람에게 알린다. 잡 주기는 10분이다. */
export const QUOTA_STALE_RESERVATION_ALERT_AFTER_MS = 30 * 60 * 1000;

/** 같은 키가 같은 요청인지 가리는 해시를 지울 때까지. 재시도는 그 전에 끝나고, 사용자 글자에서 나온 값이라 오래 두지 않는다. */
export const QUOTA_REQUEST_HASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** 처리하던 요청이 끝내 응답하지 못해 정리 작업이 돌려준 예약의 환불 사유 */
export const QUOTA_ABANDONED_REFUND_REASON = "ABANDONED";

/** 정리 작업 한 번에 돌려주는 멈춘 예약 수. 남은 예약은 다음 주기가 이어 받는다. */
export const QUOTA_ABANDONED_REFUND_BATCH_SIZE = 500;
