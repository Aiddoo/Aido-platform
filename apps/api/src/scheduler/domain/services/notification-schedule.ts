/**
 * 고정 시간 알림 스케줄 정책 (유저 로컬 타임존 기준, 순수 도메인).
 *
 * 아침/저녁 리마인더(08:00/18:00)와 겹치지 않도록 분리된 시간대.
 * 주간 달성 배지는 월요일 08:30 (아침 리마인더 08:00 직후, 주간 리포트 09:00 직전).
 */

export interface ScheduleTime {
	readonly hour: number;
	readonly minute: number;
}

export const NOTIFICATION_SCHEDULE = {
	WEEKLY_REPORT: { hour: 9, minute: 0 },
	MONTHLY_REPORT: { hour: 10, minute: 0 },
	WEEKLY_ACHIEVEMENT: { hour: 8, minute: 30 },
	WINBACK: { hour: 12, minute: 0 },
	NUDGE_SUGGEST: { hour: 14, minute: 0 },
	LUNCH_NUDGE: { hour: 12, minute: 30 },
	STREAK_AT_RISK: { hour: 20, minute: 0 },
} as const satisfies Record<string, ScheduleTime>;

/** 로컬 시:분이 지정 스케줄과 정확히 일치하는지 판정 */
export function matchesScheduleTime(
	schedule: ScheduleTime,
	localHour: number,
	localMinute: number,
): boolean {
	return schedule.hour === localHour && schedule.minute === localMinute;
}

/** 월요일 여부 (0=일, 1=월) */
export const MONDAY = 1;

/** 매월 1일 여부 판정용 */
export const FIRST_DAY_OF_MONTH = 1;
