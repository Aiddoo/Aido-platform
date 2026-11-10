import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, isNotNull, lt } from "drizzle-orm";
import { sumBy, uniq } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoCategory } from "#api/platform/database/schema/index";
import { toDateString } from "#api/shared/domain/date/utils/format";

import type {
  AggregateByDateRangeParams,
  TodoCompletionRepositoryPort,
} from "../../application/ports/todo-completion.repository.port.js";
import type {
  MultiDayTodoSpan,
  TodoAggregateByDate,
} from "../../domain/daily-completion.read-model.js";

@Injectable()
export class DrizzleTodoCompletionRepository implements TodoCompletionRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  aggregateByDateRange(params: AggregateByDateRangeParams): Promise<TodoAggregateByDate[]> {
    return this.#aggregate(params, false);
  }

  aggregatePublicByDateRange(params: AggregateByDateRangeParams): Promise<TodoAggregateByDate[]> {
    return this.#aggregate(params, true);
  }

  findMultiDayTodos(params: AggregateByDateRangeParams): Promise<MultiDayTodoSpan[]> {
    return this.#findMultiDayTodos(params, false);
  }

  findPublicMultiDayTodos(params: AggregateByDateRangeParams): Promise<MultiDayTodoSpan[]> {
    return this.#findMultiDayTodos(params, true);
  }

  /** `Todo_userId_startDate_endDate_idx`를 타는 쿼리 하나다. 날짜 칸 조건은 할 일 목록의 `todoDateCondition`과 같다. */
  async #findMultiDayTodos(
    params: AggregateByDateRangeParams,
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
          eq(todo.userId, params.userId),
          isNotNull(todo.endDate),
          lt(todo.startDate, params.endDate),
          gte(todo.endDate, params.startDate),
          publicOnly ? eq(todo.visibility, "PUBLIC") : undefined,
        ),
      );
    return rows.flatMap(({ endDate, startDate, ...row }) =>
      endDate == null || endDate.getTime() <= startDate.getTime()
        ? []
        : [{ ...row, startDate: toDateString(startDate), endDate: toDateString(endDate) }],
    );
  }

  async #aggregate(
    params: AggregateByDateRangeParams,
    publicOnly: boolean,
  ): Promise<TodoAggregateByDate[]> {
    const groups = await this.#db
      .select({
        startDate: todo.startDate,
        categoryId: todo.categoryId,
        completed: todo.completed,
        count: count(),
      })
      .from(todo)
      .where(
        and(
          eq(todo.userId, params.userId),
          gte(todo.startDate, params.startDate),
          lt(todo.startDate, params.endDate),
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
    return [...Map.groupBy(groups, (group) => group.startDate.getTime())].map(([time, rows]) => ({
      date: new Date(time),
      total: sumBy(rows, (row) => row.count),
      completed: sumBy(rows, (row) => (row.completed ? row.count : 0)),
      // GROUP BY 순서는 보장되지 않는다. 앱의 정렬(uniq 후 문자열 오름차순)과 같은 순서로 내려준다
      categoryColors: uniq(
        rows.flatMap((row) => {
          const color = colors.get(row.categoryId);
          return color == null ? [] : [color];
        }),
      ).toSorted(),
    }));
  }
}
