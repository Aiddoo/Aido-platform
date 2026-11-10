import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, isNotNull, lt } from "drizzle-orm";
import { uniq } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoCategory } from "#api/platform/database/schema/index";

import {
  type DailyCompletionRangeQuery,
  DailyCompletionRepositoryPort,
} from "../../application/ports/daily-completion.repository.port.js";
import type { MultiDayTodoSpan } from "../../application/read-models/daily-completion-range.read-model.js";
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

  listMultiDayTodoSpans(query: DailyCompletionRangeQuery): Promise<MultiDayTodoSpan[]> {
    return this.#listMultiDayTodoSpans(query, false);
  }

  listPublicMultiDayTodoSpans(query: DailyCompletionRangeQuery): Promise<MultiDayTodoSpan[]> {
    return this.#listMultiDayTodoSpans(query, true);
  }

  /** `Todo_userId_startDate_endDate_idx`를 타는 쿼리 하나다. 날짜 칸 조건은 할 일 목록의 `todoDateCondition`과 같다. */
  async #listMultiDayTodoSpans(
    { userId, range }: DailyCompletionRangeQuery,
    publicOnly: boolean,
  ): Promise<MultiDayTodoSpan[]> {
    const rows = await this.#db
      .select({
        startDate: todo.startDate,
        endDate: todo.endDate,
        completed: todo.completed,
        categoryColor: todoCategory.color,
      })
      .from(todo)
      .innerJoin(todoCategory, eq(todo.categoryId, todoCategory.id))
      .where(
        and(
          eq(todo.userId, userId.value),
          isNotNull(todo.endDate),
          lt(todo.startDate, toDateColumnValue(range.end.add({ days: 1 }))),
          gte(todo.endDate, toDateColumnValue(range.start)),
          publicOnly ? eq(todo.visibility, "PUBLIC") : undefined,
        ),
      );
    return rows.flatMap(({ endDate, startDate, ...row }) =>
      endDate == null || endDate.getTime() <= startDate.getTime()
        ? []
        : [{ ...row, startDate: toCalendarDate(startDate), endDate: toCalendarDate(endDate) }],
    );
  }

  async #listCompletions(
    { userId, range }: DailyCompletionRangeQuery,
    publicOnly: boolean,
  ): Promise<DailyCompletion[]> {
    const groups = await this.#db
      .select({
        startDate: todo.startDate,
        categoryId: todo.categoryId,
        completed: todo.completed,
        todoCount: count(),
      })
      .from(todo)
      .where(
        and(
          eq(todo.userId, userId.value),
          gte(todo.startDate, toDateColumnValue(range.start)),
          lt(todo.startDate, toDateColumnValue(range.end.add({ days: 1 }))),
          publicOnly ? eq(todo.visibility, "PUBLIC") : undefined,
        ),
      )
      .groupBy(todo.startDate, todo.categoryId, todo.completed);
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
        completed: group.completed,
        categoryColor: colors.get(group.categoryId) ?? null,
        todoCount: group.todoCount,
      })),
    });
  }
}
