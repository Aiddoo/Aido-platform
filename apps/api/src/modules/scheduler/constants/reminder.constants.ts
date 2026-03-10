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
 * 주간 달성 배지는 월요일 07:00 (리포트 생성 01:00과 6시간 간격, 아침 리마인더 08:00과 1시간 간격).
 * Win-back, Nudge Suggest는 기존 인라인 값과 동일 (문서화 목적).
 */
export const NOTIFICATION_SCHEDULE = {
	WEEKLY_REPORT: { hour: 9, minute: 0 },
	MONTHLY_REPORT: { hour: 10, minute: 0 },
	WEEKLY_ACHIEVEMENT: { hour: 7, minute: 0 },
	WINBACK: { hour: 12, minute: 0 },
	NUDGE_SUGGEST: { hour: 14, minute: 0 },
	LUNCH_NUDGE: { hour: 12, minute: 30 },
	STREAK_AT_RISK: { hour: 21, minute: 0 },
} as const;
