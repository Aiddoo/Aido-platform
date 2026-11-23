import {
  type CustomTimeReminderParams,
  type FixedTimeReminderParams,
  type PeriodReportParams,
  ScheduledReminderReaderPort,
} from "#api/modules/notification/reminders/application/ports/scheduled-reminder-reader.port";
import type {
  EveningReminderUserReadModel,
  ReminderCountUserReadModel,
  UserIdReadModel,
} from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";

export interface ScheduledReminderQuery {
  readonly method: keyof ScheduledReminderReaderPort;
  readonly params: CustomTimeReminderParams | FixedTimeReminderParams | PeriodReportParams;
}

// 조회마다 넣어 둔 대상을 그대로 주고 조회 조건을 남긴다. 유료·무료 구분과 시각 조건은 SQL이 맡는다
export class StubScheduledReminderReader extends ScheduledReminderReaderPort {
  premiumMorningUsers: ReminderCountUserReadModel[] = [];
  freeMorningUsers: ReminderCountUserReadModel[] = [];
  premiumEveningUsers: EveningReminderUserReadModel[] = [];
  freeEveningUsers: EveningReminderUserReadModel[] = [];
  lunchNudgeUsers: UserIdReadModel[] = [];
  weeklyReportRecipients: UserIdReadModel[] = [];
  monthlyReportRecipients: UserIdReadModel[] = [];
  readonly queries: ScheduledReminderQuery[] = [];

  async listPremiumMorningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<ReminderCountUserReadModel[]> {
    this.queries.push({ method: "listPremiumMorningReminderUsers", params });
    return this.premiumMorningUsers;
  }

  async listFreeMorningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<ReminderCountUserReadModel[]> {
    this.queries.push({ method: "listFreeMorningReminderUsers", params });
    return this.freeMorningUsers;
  }

  async listPremiumEveningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<EveningReminderUserReadModel[]> {
    this.queries.push({ method: "listPremiumEveningReminderUsers", params });
    return this.premiumEveningUsers;
  }

  async listFreeEveningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<EveningReminderUserReadModel[]> {
    this.queries.push({ method: "listFreeEveningReminderUsers", params });
    return this.freeEveningUsers;
  }

  async listLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdReadModel[]> {
    this.queries.push({ method: "listLunchNudgeUsers", params });
    return this.lunchNudgeUsers;
  }

  async listWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdReadModel[]> {
    this.queries.push({ method: "listWeeklyReportRecipients", params });
    return this.weeklyReportRecipients;
  }

  async listMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdReadModel[]> {
    this.queries.push({ method: "listMonthlyReportRecipients", params });
    return this.monthlyReportRecipients;
  }

  queriedMethods(): Array<keyof ScheduledReminderReaderPort> {
    return this.queries.map(({ method }) => method);
  }
}
