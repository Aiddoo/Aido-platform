import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, sql, type SQL } from "drizzle-orm";

import { freeAccessCondition } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  WeeklyAchievementStatsReaderPort,
  WeeklyStatsParams,
} from "../../application/ports/weekly-achievement-stats-reader.port.js";
import type { UserTodoCountReadModel } from "../../application/read-models/scheduler.read-model.js";
import { accessCheckedAt, userInTimezones } from "./scheduler.query-fragment.js";

@Injectable()
export class DrizzleWeeklyAchievementStatsReader implements WeeklyAchievementStatsReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#transactionHost = transactionHost;
    this.#clock = clock;
  }

  groupTotalTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCountReadModel[]> {
    return this.#countTodoDaysByUser(params);
  }

  groupCompletedTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCountReadModel[]> {
    return this.#countTodoDaysByUser(params, eq(todo.completed, true));
  }

  // 여러 날 할 일은 기간 안에 걸친 날마다 하나로 센다. 끝없이 긴 할 일도 기간 안의 날만 더한다
  #countTodoDaysByUser(params: WeeklyStatsParams, extra?: SQL): Promise<UserTodoCountReadModel[]> {
    const { timezones, periodStart, periodEnd } = params;
    const firstDay = sql`${sql.param(periodStart, todo.startDate)}::date`;
    const lastDay = sql`(${sql.param(periodEnd, todo.startDate)}::date - 1)`;
    const todoLastDay = sql`coalesce(${todo.endDate}, ${todo.startDate})`;
    const daysInPeriod = sql<number>`sum(greatest(0, least(${todoLastDay}, ${lastDay}) - greatest(${todo.startDate}, ${firstDay}) + 1))::int`;
    return this.#db
      .select({ userId: todo.userId, count: daysInPeriod })
      .from(todo)
      .where(
        and(
          sql`${todo.startDate} <= ${lastDay}`,
          sql`${todoLastDay} >= ${firstDay}`,
          extra,
          userInTimezones(this.#db, timezones),
        ),
      )
      .groupBy(todo.userId);
  }

  async findFreeRecipientIds(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        id: { in: userIds },
        RAW: (target) => freeAccessCondition(target, accessCheckedAt(this.#clock)),
      },
    });
    return new Set(rows.map((row) => row.id));
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
