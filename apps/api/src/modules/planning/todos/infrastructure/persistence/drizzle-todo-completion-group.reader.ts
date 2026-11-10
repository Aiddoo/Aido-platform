import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, isNull, lte, or } from "drizzle-orm";
import { uniq } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";

import {
  type TodoCompletionGroup,
  type TodoCompletionGroupQuery,
  TodoCompletionGroupReaderPort,
} from "../../application/ports/todo-completion-group.reader.port.js";
import { toCalendarDate, toDateColumnValue } from "./todo-date-column.mapper.js";

@Injectable()
export class DrizzleTodoCompletionGroupReader implements TodoCompletionGroupReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  // 하루 조건을 구간 양끝으로 넓힌 것이고 `Todo_userId_startDate_endDate_idx`를 탄다
  async listCompletionGroups({
    userId,
    start,
    end,
    publicOnly,
  }: TodoCompletionGroupQuery): Promise<TodoCompletionGroup[]> {
    const rangeStart = toDateColumnValue(start);
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
          lte(todo.startDate, toDateColumnValue(end)),
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
    return groups.map((group) => ({
      startDate: toCalendarDate(group.startDate),
      endDate: group.endDate == null ? null : toCalendarDate(group.endDate),
      completed: group.completed,
      categoryColor: colors.get(group.categoryId) ?? null,
      todoCount: group.todoCount,
    }));
  }
}
