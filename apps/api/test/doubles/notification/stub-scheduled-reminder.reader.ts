import {
  type CustomTimeReminderParams,
  type FixedTimeReminderParams,
  type PeriodReportParams,
  ScheduledReminderReaderPort,
} from "#api/modules/notification/reminders/application/ports/scheduled-reminder-reader.port";
import type {
  EveningReminderUser,
  ReminderCountUser,
  UserIdRow,
} from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";

export interface ScheduledReminderQuery {
  readonly method: keyof ScheduledReminderReaderPort;
  readonly params: CustomTimeReminderParams | FixedTimeReminderParams | PeriodReportParams;
}

// 조회마다 넣어 둔 대상을 그대로 주고 조회 조건을 남긴다. 유료·무료 구분과 시각 조건은 SQL이 맡는다
export class StubScheduledReminderReader extends ScheduledReminderReaderPort {
  premiumMorningUsers: ReminderCountUser[] = [];
  freeMorningUsers: ReminderCountUser[] = [];
  premiumEveningUsers: EveningReminderUser[] = [];
  freeEveningUsers: EveningReminderUser[] = [];
  lunchNudgeUsers: UserIdRow[] = [];
  weeklyReportRecipients: UserIdRow[] = [];
  monthlyReportRecipients: UserIdRow[] = [];
  readonly queries: ScheduledReminderQuery[] = [];

  async findPremiumMorningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<ReminderCountUser[]> {
    this.queries.push({ method: "findPremiumMorningReminderUsers", params });
    return this.premiumMorningUsers;
  }

  async findFreeMorningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<ReminderCountUser[]> {
    this.queries.push({ method: "findFreeMorningReminderUsers", params });
    return this.freeMorningUsers;
  }

  async findPremiumEveningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<EveningReminderUser[]> {
    this.queries.push({ method: "findPremiumEveningReminderUsers", params });
    return this.premiumEveningUsers;
  }

  async findFreeEveningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<EveningReminderUser[]> {
    this.queries.push({ method: "findFreeEveningReminderUsers", params });
    return this.freeEveningUsers;
  }

  async findLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdRow[]> {
    this.queries.push({ method: "findLunchNudgeUsers", params });
    return this.lunchNudgeUsers;
  }

  async findWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]> {
    this.queries.push({ method: "findWeeklyReportRecipients", params });
    return this.weeklyReportRecipients;
  }

  async findMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]> {
    this.queries.push({ method: "findMonthlyReportRecipients", params });
    return this.monthlyReportRecipients;
  }

  queriedMethods(): Array<keyof ScheduledReminderReaderPort> {
    return this.queries.map(({ method }) => method);
  }
}
