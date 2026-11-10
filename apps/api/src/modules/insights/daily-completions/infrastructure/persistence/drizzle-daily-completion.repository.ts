import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, isNull, lte, or } from "drizzle-orm";
import { uniq } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";

import {
  type DailyCompletionRangeQuery,
  DailyCompletionRepositoryPort,
} from "../../application/ports/daily-completion.repository.port.js";
import { tallyDailyCompletions } from "../../domain/daily-completion.domain-service.js";
import type { DailyCompletion } from "../../domain/daily-completion.entity.js";
import { toCalendarDate, toDateColumnValue } from "./todo-date-row.mapper.js";

// insights는 아직 planning Todo·TodoCategory 테이블을 직접 읽는다(planning 공개 조회 포트로 옮길 후속)
@Injectable()
export class DrizzleDailyCompletionRepository implements DailyCompletionRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  listByDateRange(query: DailyCompletionRangeQuery): Promise<DailyCompletion[]> {
    return this.#listCompletions(query, false);
  }

  listPublicByDateRange(query: DailyCompletionRangeQuery): Promise<DailyCompletion[]> {
    return this.#listCompletions(query, true);
  }

  /**
   * 구간의 어느 날에든 있는 할 일을 기간째 묶어 읽고, 날짜별로 펼치는 일은 도메인 규칙(tallyDailyCompletions)이 한다.
   * 겹침 조건은 identity 연속 기록의 하루 조건(startDate <= 그날 AND (endDate >= 그날 OR (endDate 없음 AND startDate = 그날)))을
   * 구간 양끝으로 넓힌 것이고 `Todo_userId_startDate_endDate_idx`를 탄다.
   */
  async #listCompletions(
    { userId, range }: DailyCompletionRangeQuery,
    publicOnly: boolean,
  ): Promise<DailyCompletion[]> {
    const rangeStart = toDateColumnValue(range.start);
    const groups = await this.#db
      .select({
        startDate: todo.startDate,
        endDate: todo.endDate,
        categoryId: todo.categoryId,
        completed: todo.completed,
        todoCount: count(),
      })
      .from(todo)
      .where(
        and(
          eq(todo.userId, userId.value),
          lte(todo.startDate, toDateColumnValue(range.end)),
          or(
            gte(todo.endDate, rangeStart),
            and(isNull(todo.endDate), gte(todo.startDate, rangeStart)),
          ),
          publicOnly ? eq(todo.visibility, "PUBLIC") : undefined,
        ),
      )
      .groupBy(todo.startDate, todo.endDate, todo.categoryId, todo.completed);
    if (groups.length === 0) {
      return [];
    }

    const categories = await this.#db.query.todoCategory.findMany({
      columns: { id: true, color: true },
      where: { id: { in: uniq(groups.map((group) => group.categoryId)) } },
    });
    const colors = new Map(categories.map((category) => [category.id, category.color]));
    return tallyDailyCompletions({
      userId,
      range,
      groups: groups.map((group) => ({
        startDate: toCalendarDate(group.startDate),
        endDate: group.endDate == null ? null : toCalendarDate(group.endDate),
        completed: group.completed,
        categoryColor: colors.get(group.categoryId) ?? null,
        todoCount: group.todoCount,
      })),
    });
  }
}
