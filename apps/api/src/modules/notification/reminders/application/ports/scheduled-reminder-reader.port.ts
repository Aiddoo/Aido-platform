import type {
  ReminderCountUser,
  UserIdRow,
  UserWithTodosAndStreak,
} from "../read-models/scheduler.read-model.js";

export interface CustomTimeReminderParams {
  readonly tz: string;
  readonly hour: number;
  readonly minute: number;
  readonly today: Temporal.PlainDate;
  readonly tomorrow: Temporal.PlainDate;
  /** 리마인더 시간을 바꾼 직후 그 사용자만 볼 때 */
  readonly userId?: string;
}

export interface FixedTimeReminderParams {
  readonly tz: string;
  readonly today: Temporal.PlainDate;
  readonly tomorrow: Temporal.PlainDate;
}

export interface PeriodReportParams {
  readonly tz: string;
  readonly periodStart: Temporal.PlainDate;
  readonly periodEnd: Temporal.PlainDate;
}

// 유료는 고른 시각, 무료는 고정 시각 쿼리를 따로 두어 전략이 "무료 조회 생략"을 정한다
export abstract class ScheduledReminderReaderPort {
  abstract findPremiumMorningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<ReminderCountUser[]>;
  abstract findFreeMorningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<ReminderCountUser[]>;
  /** 오늘 할 일이 있는 사용자만 */
  abstract findPremiumEveningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<UserWithTodosAndStreak[]>;
  /** 오늘 할 일이 있는 사용자만 */
  abstract findFreeEveningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<UserWithTodosAndStreak[]>;
  /** 오늘 할 일이 있지만 하나도 끝내지 않은 사용자 */
  abstract findLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdRow[]>;
  abstract findWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]>;
  abstract findMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]>;
}
