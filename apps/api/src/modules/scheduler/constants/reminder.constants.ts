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
