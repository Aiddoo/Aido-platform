import { HOUR_MS } from "#api/shared/domain/time/time-units";

/** 푸시 피로도 제한 정책의 단일 원본. */
export const PUSH_RATE_LIMIT_POLICY = {
  GENERAL: {
    WINDOW_MS: HOUR_MS,
    MAX: 15,
  },
  ENGAGEMENT: {
    MIN_INTERVAL_MS: 4 * HOUR_MS,
    DAILY_MAX: 2,
    // 현지 하루(최대 25시간)와 일반 창(1시간)이 끝난 예약만 남는 길이다. 저장소마다 이 기간 뒤 예약을 버린다
    RETENTION_MS: 48 * HOUR_MS,
  },
} as const;
