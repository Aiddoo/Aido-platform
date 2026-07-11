/**
 * 고정/커스텀 시간 리마인더 수신자 조회 포트.
 *
 * 아침·저녁 리마인더, 주간·월간 리포트, 점심 넛지 수신자 조회를 담당한다.
 * (프리미엄 = 커스텀 시간, 무료 = 고정 시간 쿼리를 별도 메서드로 분리해
 *  전략이 "무료 쿼리 스킵" 조건을 그대로 제어)
 */
import type {
	ReminderCountUser,
	UserIdRow,
	UserWithTodosAndStreak,
} from "./scheduler-read-models";

export const SCHEDULED_REMINDER_READER = Symbol("SCHEDULED_REMINDER_READER");

/** 커스텀 시간(시:분) 매칭 조회 파라미터 */
export interface CustomTimeReminderParams {
	readonly tz: string;
	readonly hour: number;
	readonly minute: number;
	readonly today: Date;
	readonly tomorrow: Date;
	/** catch-up 발송 시 특정 유저만 대상 */
	readonly userId?: string;
}

/** 고정 시간(무료 유저) 조회 파라미터 */
export interface FixedTimeReminderParams {
	readonly tz: string;
	readonly today: Date;
	readonly tomorrow: Date;
}

/** 기간 기반 리포트 수신자 조회 파라미터 */
export interface PeriodReportParams {
	readonly tz: string;
	readonly periodStart: Date;
	readonly periodEnd: Date;
}

export interface ScheduledReminderReaderPort {
	/** 프리미엄 아침 리마인더 수신자 (커스텀 시간) */
	findPremiumMorningReminderUsers(
		params: CustomTimeReminderParams,
	): Promise<ReminderCountUser[]>;

	/** 무료 아침 리마인더 수신자 (고정 08:00) */
	findFreeMorningReminderUsers(
		params: FixedTimeReminderParams,
	): Promise<ReminderCountUser[]>;

	/** 프리미엄 저녁 리마인더 수신자 (커스텀 시간, 오늘 투두 보유) */
	findPremiumEveningReminderUsers(
		params: CustomTimeReminderParams,
	): Promise<UserWithTodosAndStreak[]>;

	/** 무료 저녁 리마인더 수신자 (고정 18:00, 오늘 투두 보유) */
	findFreeEveningReminderUsers(
		params: FixedTimeReminderParams,
	): Promise<UserWithTodosAndStreak[]>;

	/** 점심 넛지 대상 (오늘 투두 있으나 완료 0개) */
	findLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdRow[]>;

	/** 주간 리포트 수신자 (프리미엄, 지난 주 투두 보유) */
	findWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]>;

	/** 월간 리포트 수신자 (프리미엄, 지난 달 투두 보유) */
	findMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]>;
}
