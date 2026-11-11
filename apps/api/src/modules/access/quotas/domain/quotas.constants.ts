import type { MeteredFeatureKey, QuotaMeter } from "@aido/api/vocabulary";

export const QUOTA_CHARGE_AMOUNT = 1;

/** 계량기마다 차감하는 기능. PLAN_CATALOG의 meter와 같아야 한다(단위 테스트가 지킨다). */
export const QUOTA_METER_FEATURES = {
  AI_PLAN: "AI_PARSE",
  VOICE_NOTE: "VOICE_NOTE",
} as const satisfies Record<QuotaMeter, MeteredFeatureKey>;

/**
 * 같은 키의 RESERVED가 이 시간보다 오래되면 처리하던 요청이 끝내 응답하지 못한 것으로 보고 이어받는다.
 * 가장 긴 AI 작업 제한 시간(수십 초)보다 넉넉하게 둔다.
 */
export const QUOTA_RESERVATION_TAKEOVER_AFTER_MS = 120_000;

/** RESERVED가 이 시간을 넘게 남아 있으면 정리 잡이 돌지 못한 것이라 사람에게 알린다. 잡 주기는 10분이다. */
export const QUOTA_STALE_RESERVATION_ALERT_AFTER_MS = 30 * 60 * 1000;

/** 같은 키가 같은 요청인지 가리는 해시를 지울 때까지. 재시도는 그 전에 끝나고, 사용자 글자에서 나온 값이라 오래 두지 않는다. */
export const QUOTA_REQUEST_HASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** 환불 사유. FAILED는 AI 호출·검증 실패, NO_ACTION은 결과에 실행할 행동이 없던 요청이다. */
const QUOTA_REFUND_REASONS = ["FAILED", "NO_ACTION"] as const;

export type QuotaRefundReason = (typeof QUOTA_REFUND_REASONS)[number];

/** 처리하던 요청이 끝내 응답하지 못해 정리 작업이 돌려준 예약의 환불 사유 */
export const QUOTA_ABANDONED_REFUND_REASON = "ABANDONED";

/** 정리 작업 한 번에 돌려주는 멈춘 예약 수. 남은 예약은 다음 주기가 이어 받는다. */
export const QUOTA_ABANDONED_REFUND_BATCH_SIZE = 500;

/**
 * 같은 Idempotency-Key로 다시 예약할 때의 판단.
 * COMMITTED는 이미 결과를 준 요청(다시 차감하지 않는다), IN_FLIGHT는 아직 처리 중인 요청(차감 없이 충돌),
 * TAKE_OVER는 응답하지 못하고 멈춘 요청(이미 차감한 횟수로 이어받는다), RETRY는 환불한 요청(같은 행에서 다시
 * 차감한다)이다.
 */
const QUOTA_CHARGE_REPLAYS = ["COMMITTED", "IN_FLIGHT", "TAKE_OVER", "RETRY"] as const;

export type QuotaChargeReplay = (typeof QUOTA_CHARGE_REPLAYS)[number];
