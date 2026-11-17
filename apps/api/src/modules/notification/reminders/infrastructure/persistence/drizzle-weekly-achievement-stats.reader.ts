import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, inArray } from "drizzle-orm";

import { freeAccessCondition } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { userRecipients } from "#api/modules/identity/users/identity-users.public";
import { todoDaysInPeriodByUser } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { instantToDate } from "#api/shared/domain/time/instant";

import type {
  WeeklyAchievementStatsReaderPort,
  WeeklyStatsParams,
} from "../../application/ports/weekly-achievement-stats-reader.port.js";
import type { UserTodoCountReadModel } from "../../application/read-models/scheduler.read-model.js";
import { userInTimezones } from "./scheduler.query-fragment.js";

@Injectable()
export class DrizzleWeeklyAchievementStatsReader implements WeeklyAchievementStatsReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#transactionHost = transactionHost;
    this.#clock = clock;
  }

  groupTotalTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCountReadModel[]> {
    return this.#countTodoDaysByUser(params, false);
  }

  groupCompletedTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCountReadModel[]> {
    return this.#countTodoDaysByUser(params, true);
  }

  #countTodoDaysByUser(
    params: WeeklyStatsParams,
    completedOnly: boolean,
  ): Promise<UserTodoCountReadModel[]> {
    const { timezones, periodStart, periodEnd } = params;
    const days = todoDaysInPeriodByUser({ periodStart, periodEnd, completedOnly });
    return this.#db
      .select({ userId: days.userId, count: days.count })
      .from(days)
      .where(userInTimezones(days.userId, timezones));
  }

  async findFreeRecipientIds(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const recipients = userRecipients();
    const rows = await this.#db
      .select({ id: recipients.userId })
      .from(recipients.table)
      .where(
        and(
          inArray(recipients.userId, userIds),
          freeAccessCondition(recipients.table, instantToDate(this.#clock.now())),
        ),
      );
    return new Set(rows.map((row) => row.id));
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
