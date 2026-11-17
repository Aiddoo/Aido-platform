import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";

import {
  freeAccessCondition,
  premiumAccessCondition,
} from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { instantToDate } from "#api/shared/domain/time/instant";

import { notificationRetentionAssignmentsConfig } from "../../../retention-assignments/notification-retention-assignments.public.js";
import type {
  CustomTimeReminderParams,
  FixedTimeReminderParams,
  PeriodReportParams,
  ScheduledReminderReaderPort,
} from "../../application/ports/scheduled-reminder-reader.port.js";
import type {
  EveningReminderUserReadModel,
  ReminderCountUserReadModel,
  UserIdReadModel,
} from "../../application/read-models/scheduler.read-model.js";
import { withPreferenceTimezone } from "./scheduler-row.mapper.js";
import {
  todayTodoCount,
  recentTreatmentExclusion,
  type SchedulerRetentionSettings,
} from "./scheduler.query-fragment.js";

@Injectable()
export class DrizzleScheduledReminderReader implements ScheduledReminderReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #retention: SchedulerRetentionSettings;
  readonly #clock: ClockPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    @Inject(notificationRetentionAssignmentsConfig.KEY) retention: SchedulerRetentionSettings,
    clock: ClockPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#retention = retention;
    this.#clock = clock;
  }

  async findPremiumMorningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<ReminderCountUserReadModel[]> {
    const { timezones, hour, minute, today, tomorrow, userId } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId != null && { id: userId.value }),
        RAW: (target) => premiumAccessCondition(target, instantToDate(this.#clock.now())),
        preference: {
          timezone: { in: [...timezones] },
          morningReminderHour: hour,
          morningReminderMinute: minute,
        },
      },
      with: { preference: { columns: { locale: true } } },
      extras: { todoCount: (user) => todayTodoCount(this.#db, user.id, today, tomorrow) },
    });
    return rows.map(({ todoCount, ...row }) => ({ ...row, _count: { todos: todoCount } }));
  }

  async findFreeMorningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<ReminderCountUserReadModel[]> {
    const { timezones, today, tomorrow } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        RAW: (target) => freeAccessCondition(target, instantToDate(this.#clock.now())),
        preference: { timezone: { in: [...timezones] } },
      },
      with: { preference: { columns: { locale: true } } },
      extras: { todoCount: (user) => todayTodoCount(this.#db, user.id, today, tomorrow) },
    });
    return rows.map(({ todoCount, ...row }) => ({ ...row, _count: { todos: todoCount } }));
  }

  async findPremiumEveningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<EveningReminderUserReadModel[]> {
    const { timezones, hour, minute, today, tomorrow, userId } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId != null && { id: userId.value }),
        RAW: (target) => premiumAccessCondition(target, instantToDate(this.#clock.now())),
        preference: {
          timezone: { in: [...timezones] },
          eveningReminderHour: hour,
          eveningReminderMinute: minute,
        },
        todos: { startDate: { gte: today, lt: tomorrow } },
      },
      with: {
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
        preference: {
          columns: { currentStreak: true, lastCompletedDate: true, locale: true, timezone: true },
        },
      },
    });
    return withPreferenceTimezone(rows);
  }

  async findFreeEveningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<EveningReminderUserReadModel[]> {
    const { timezones, today, tomorrow } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        RAW: (target) => freeAccessCondition(target, instantToDate(this.#clock.now())),
        preference: { timezone: { in: [...timezones] } },
        todos: { startDate: { gte: today, lt: tomorrow } },
      },
      with: {
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
        preference: {
          columns: { currentStreak: true, lastCompletedDate: true, locale: true, timezone: true },
        },
      },
    });
    return withPreferenceTimezone(rows);
  }

  findLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdReadModel[]> {
    const { timezones, today, tomorrow } = params;
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          ...recentTreatmentExclusion(this.#retention, this.#clock),
          { preference: { timezone: { in: [...timezones] } } },
          {
            todos: {
              startDate: { gte: today, lt: tomorrow },
            },
          },
          {
            NOT: {
              todos: {
                startDate: { gte: today, lt: tomorrow },
                completed: true,
              },
            },
          },
        ],
      },
    });
  }

  findWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdReadModel[]> {
    return this.#findPeriodReportRecipients(params);
  }

  findMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdReadModel[]> {
    return this.#findPeriodReportRecipients(params);
  }

  #findPeriodReportRecipients(params: PeriodReportParams): Promise<UserIdReadModel[]> {
    const { timezones, periodStart, periodEnd } = params;
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        preference: { timezone: { in: [...timezones] } },
        RAW: (target) => premiumAccessCondition(target, instantToDate(this.#clock.now())),
        todos: {
          startDate: { gte: periodStart, lt: periodEnd },
        },
      },
    });
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
