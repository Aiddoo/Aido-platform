/**
 * 고정 시간 알림 스케줄 정책 (유저 로컬 타임존 기준, 순수 도메인).
 *
 * 한국 사용자 생활 리듬과 단일 DB/Redis 부하 분산을 함께 고려한 고정 시간대.
 * 사용자 커스텀 아침/저녁·날씨 알림은 각 Strategy가 별도로 시:분을 매칭한다.
 */

export interface ScheduleTime {
	readonly hour: number;
	readonly minute: number;
}

export const NOTIFICATION_SCHEDULE = {
	ONBOARDING: { hour: 10, minute: 30 },
	WEEKLY_REPORT: { hour: 11, minute: 30 },
	MONTHLY_REPORT: { hour: 11, minute: 30 },
	WEEKLY_ACHIEVEMENT: { hour: 11, minute: 30 },
	LUNCH_NUDGE: { hour: 12, minute: 30 },
	NUDGE_SUGGEST: { hour: 15, minute: 0 },
	WINBACK: { hour: 16, minute: 0 },
	STREAK_AT_RISK: { hour: 20, minute: 15 },
} as const satisfies Record<string, ScheduleTime>;

/** 로컬 시:분이 지정 스케줄과 정확히 일치하는지 판정 */
export function matchesScheduleTime(
	schedule: ScheduleTime,
	localHour: number,
	localMinute: number,
): boolean {
	return schedule.hour === localHour && schedule.minute === localMinute;
}

/**
 * 미스-분 캐치업용 기본 grace(분).
 *
 * every-minute sweep이 지연/누락되면 정확 일치(matchesScheduleTime)만으로는
 * 해당 슬롯이 조용히 사라진다. 슬롯 시작부터 grace분 이내면 발송 창으로 본다.
 * 모든 고정 캠페인 전략이 `(userId, type, 로컬일자)` DB 유니크로 하루 1회 멱등이라
 * 연속 분에 재실행돼도 중복 발송되지 않는다.
 */
export const SCHEDULE_GRACE_MINUTES = 3;

/**
 * 로컬 시:분이 지정 스케줄의 발송 창 `[시작, 시작+grace)` 안인지 판정.
 *
 * 절대 분(minute-of-day)으로 계산해 시 경계를 안전하게 넘긴다.
 * grace 기본값은 {@link SCHEDULE_GRACE_MINUTES}. grace=1이면 정각만 매칭한다.
 */
export function isWithinScheduleWindow(
	schedule: ScheduleTime,
	localHour: number,
	localMinute: number,
	graceMinutes: number = SCHEDULE_GRACE_MINUTES,
): boolean {
	const nowMinutes = localHour * 60 + localMinute;
	const startMinutes = schedule.hour * 60 + schedule.minute;
	return nowMinutes >= startMinutes && nowMinutes < startMinutes + graceMinutes;
}

/** 월요일 여부 (0=일, 1=월) */
export const MONDAY = 1;

/** 매월 1일 여부 판정용 */
export const FIRST_DAY_OF_MONTH = 1;
