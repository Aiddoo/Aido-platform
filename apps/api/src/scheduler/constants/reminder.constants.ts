export interface ReminderStage {
	readonly leadTimeMs: number;
	readonly label: string;
}

/** 리마인더 단계 (큰 leadTime부터 정렬) */
export const REMINDER_STAGES: readonly ReminderStage[] = [
	{ leadTimeMs: 60 * 60 * 1000, label: "60min" },
	{ leadTimeMs: 10 * 60 * 1000, label: "10min" },
] as const;

/** 최대 리드 타임 (복구/크론 범위 계산용) */
export const REMINDER_MAX_LEAD_TIME_MS =
	REMINDER_STAGES[0]?.leadTimeMs ?? 60 * 60 * 1000;

/** 즉시 발송 label */
export const REMINDER_IMMEDIATE_LABEL = "immediate";

/** 하위 호환: 기존 임포트 유지 */
export const REMINDER_LEAD_TIME_MS = REMINDER_MAX_LEAD_TIME_MS;

/**
 * 고정 시간 알림 스케줄 (유저 로컬 타임존 기준)
 *
 * 아침/저녁 리마인더(08:00/18:00)와 겹치지 않도록 분리된 시간대.
 * 주간 달성 배지는 월요일 08:30 (아침 리마인더 08:00 직후, 주간 리포트 09:00 직전).
 * Win-back, Nudge Suggest는 기존 인라인 값과 동일 (문서화 목적).
 */
/** 온보딩 알림 발송 대상 day (가입 후 경과일) */
export const ONBOARDING_DAYS = [0, 1, 2, 3, 5, 7] as const;

/** 온보딩 최대 경과일 (DB 조회 범위 제한용) */
export const ONBOARDING_MAX_DAY = 7;

/** Win-back 단계 정의 (threshold 내림차순, .find()로 첫 매칭 사용) */
export const WINBACK_STAGES = [
	{ threshold: 30, stage: "day30" },
	{ threshold: 21, stage: "day21" },
	{ threshold: 14, stage: "day14" },
	{ threshold: 7, stage: "day7" },
	{ threshold: 0, stage: "day3" },
] as const;

export const NOTIFICATION_SCHEDULE = {
	WEEKLY_REPORT: { hour: 9, minute: 0 },
	MONTHLY_REPORT: { hour: 10, minute: 0 },
	WEEKLY_ACHIEVEMENT: { hour: 8, minute: 30 },
	WINBACK: { hour: 12, minute: 0 },
	NUDGE_SUGGEST: { hour: 14, minute: 0 },
	LUNCH_NUDGE: { hour: 12, minute: 30 },
	STREAK_AT_RISK: { hour: 20, minute: 0 },
} as const;
