import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  EveningReminderUser,
  ReminderCountUser,
  UserIdRow,
} from "../read-models/scheduler.read-model.js";

export interface CustomTimeReminderParams {
  /** 이 분에 현지 날짜·시·분이 같은 시간대들 */
  readonly timezones: readonly string[];
  readonly hour: number;
  readonly minute: number;
  readonly today: Temporal.PlainDate;
  readonly tomorrow: Temporal.PlainDate;
  /** 리마인더 시간을 바꾼 직후 그 사용자만 볼 때 */
  readonly userId?: UserId;
}

export interface FixedTimeReminderParams {
  readonly timezones: readonly string[];
  readonly today: Temporal.PlainDate;
  readonly tomorrow: Temporal.PlainDate;
}

export interface PeriodReportParams {
  readonly timezones: readonly string[];
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
  ): Promise<EveningReminderUser[]>;
  /** 오늘 할 일이 있는 사용자만 */
  abstract findFreeEveningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<EveningReminderUser[]>;
  /** 오늘 할 일이 있지만 하나도 끝내지 않은 사용자 */
  abstract findLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdRow[]>;
  abstract findWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]>;
  abstract findMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]>;
}
