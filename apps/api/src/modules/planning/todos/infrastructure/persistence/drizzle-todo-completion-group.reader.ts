import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq } from "drizzle-orm";
import { uniq } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";

import {
  type TodoCompletionGroup,
  type TodoCompletionGroupQuery,
  TodoCompletionGroupReaderPort,
} from "../../application/ports/todo-completion-group.reader.port.js";
import { todoDateCondition } from "./drizzle-todo-read.repository.js";

@Injectable()
export class DrizzleTodoCompletionGroupReader implements TodoCompletionGroupReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  // 하루 조건을 구간 양끝으로 넓힌 것이다
  async listCompletionGroups({
    userId,
    start,
    end,
    publicOnly,
  }: TodoCompletionGroupQuery): Promise<TodoCompletionGroup[]> {
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
          todoDateCondition(start, end),
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
      startDate: group.startDate,
      endDate: group.endDate,
      completed: group.completed,
      categoryColor: colors.get(group.categoryId) ?? null,
      todoCount: group.todoCount,
    }));
  }
}
