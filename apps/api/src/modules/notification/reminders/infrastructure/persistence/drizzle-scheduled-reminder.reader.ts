import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, not, or, type SQL } from "drizzle-orm";

import {
  freeAccessCondition,
  premiumAccessCondition,
} from "#api/modules/access/feature-grants/access-feature-grants.public";
import { userReminderPreference } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { userRecipients } from "#api/modules/identity/users/identity-users.public";
import {
  hasCompletedTodoBetween,
  hasTodoBetween,
  todoCompletionsBetween,
  todoCountBetween,
} from "#api/modules/planning/todos/planning-todos-queries.public";
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
import { toEveningReminderUser, toReminderCountUser } from "./scheduler-row.mapper.js";
import {
  recentTreatmentExclusion,
  type SchedulerRetentionSettings,
  userInTimezones,
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

  async listPremiumMorningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<ReminderCountUserReadModel[]> {
    const { times, userId } = params;
    // 빈 times로 or()를 만들면 조건이 사라져 모든 프리미엄 사용자가 맞는다
    if (times.length === 0) {
      return [];
    }
    const recipients = userRecipients();
    return this.#morningReminderUsers(
      params,
      and(
        userId == null ? undefined : eq(recipients.userId, userId.value),
        premiumAccessCondition(recipients.table, this.#now()),
      ),
      (preference) =>
        or(
          ...times.map(({ hour, minute }) =>
            and(
              eq(preference.morningReminderHour, hour),
              eq(preference.morningReminderMinute, minute),
            ),
          ),
        ),
    );
  }

  async listFreeMorningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<ReminderCountUserReadModel[]> {
    return this.#morningReminderUsers(
      params,
      freeAccessCondition(userRecipients().table, this.#now()),
      () => undefined,
    );
  }

  async listPremiumEveningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<EveningReminderUserReadModel[]> {
    const { times, userId } = params;
    // 빈 times로 or()를 만들면 조건이 사라져 모든 프리미엄 사용자가 맞는다
    if (times.length === 0) {
      return [];
    }
    const recipients = userRecipients();
    return this.#eveningReminderUsers(
      params,
      and(
        userId == null ? undefined : eq(recipients.userId, userId.value),
        premiumAccessCondition(recipients.table, this.#now()),
      ),
      (preference) =>
        or(
          ...times.map(({ hour, minute }) =>
            and(
              eq(preference.eveningReminderHour, hour),
              eq(preference.eveningReminderMinute, minute),
            ),
          ),
        ),
    );
  }

  async listFreeEveningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<EveningReminderUserReadModel[]> {
    return this.#eveningReminderUsers(
      params,
      freeAccessCondition(userRecipients().table, this.#now()),
      () => undefined,
    );
  }

  listLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdReadModel[]> {
    const { timezones, today, tomorrow } = params;
    const recipients = userRecipients();
    return this.#db
      .select({ id: recipients.userId })
      .from(recipients.table)
      .where(
        and(
          recentTreatmentExclusion(this.#retention, this.#clock, recipients.userId),
          userInTimezones(recipients.userId, timezones),
          hasTodoBetween(recipients.userId, today, tomorrow),
          not(hasCompletedTodoBetween(recipients.userId, today, tomorrow)),
        ),
      );
  }

  listWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdReadModel[]> {
    return this.#findPeriodReportRecipients(params);
  }

  listMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdReadModel[]> {
    return this.#findPeriodReportRecipients(params);
  }

  #findPeriodReportRecipients(params: PeriodReportParams): Promise<UserIdReadModel[]> {
    const { timezones, periodStart, periodEnd } = params;
    const recipients = userRecipients();
    return this.#db
      .select({ id: recipients.userId })
      .from(recipients.table)
      .where(
        and(
          userInTimezones(recipients.userId, timezones),
          premiumAccessCondition(recipients.table, this.#now()),
          hasTodoBetween(recipients.userId, periodStart, periodEnd),
        ),
      );
  }

  async #morningReminderUsers(
    params: FixedTimeReminderParams,
    recipientCondition: SQL | undefined,
    reminderTime: (preference: ReturnType<typeof userReminderPreference>) => SQL | undefined,
  ): Promise<ReminderCountUserReadModel[]> {
    const { timezones, today, tomorrow } = params;
    const recipients = userRecipients();
    const preference = userReminderPreference();
    const rows = await this.#db
      .select({
        id: recipients.userId,
        locale: preference.locale,
        todoCount: todoCountBetween(recipients.userId, today, tomorrow),
      })
      .from(recipients.table)
      .innerJoin(preference, eq(preference.userId, recipients.userId))
      .where(
        and(
          recipientCondition,
          inArray(preference.timezone, [...timezones]),
          reminderTime(preference),
        ),
      );
    return rows.map(toReminderCountUser);
  }

  async #eveningReminderUsers(
    params: FixedTimeReminderParams,
    recipientCondition: SQL | undefined,
    reminderTime: (preference: ReturnType<typeof userReminderPreference>) => SQL | undefined,
  ): Promise<EveningReminderUserReadModel[]> {
    const { timezones, today, tomorrow } = params;
    const recipients = userRecipients();
    const preference = userReminderPreference();
    const rows = await this.#db
      .select({
        id: recipients.userId,
        completions: todoCompletionsBetween(recipients.userId, today, tomorrow),
        currentStreak: preference.currentStreak,
        lastCompletedDate: preference.lastCompletedDate,
        locale: preference.locale,
        timezone: preference.timezone,
      })
      .from(recipients.table)
      .innerJoin(preference, eq(preference.userId, recipients.userId))
      .where(
        and(
          recipientCondition,
          inArray(preference.timezone, [...timezones]),
          reminderTime(preference),
          hasTodoBetween(recipients.userId, today, tomorrow),
        ),
      );
    return rows.map(toEveningReminderUser);
  }

  #now(): Date {
    return instantToDate(this.#clock.now());
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
