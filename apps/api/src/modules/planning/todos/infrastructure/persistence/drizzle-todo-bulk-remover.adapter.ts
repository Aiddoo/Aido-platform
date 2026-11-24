import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import type { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoSeries } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  RemovedCategoryTodos,
  RemovedTodo,
  TodoBulkRemoverPort,
} from "../../application/ports/todo-bulk-remover.port.js";
import { TodoId } from "../../domain/todo-id.vo.js";

@Injectable()
export class DrizzleTodoBulkRemoverAdapter implements TodoBulkRemoverPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async removeByCategory(
    userId: UserId,
    categoryId: TodoCategoryId,
  ): Promise<RemovedCategoryTodos> {
    const db = this.#transactionHost.tx;
    // categoryId만으로는 Todo 전체를 훑는다. (userId, categoryId) 인덱스로 좁힌다
    const todos = await db
      .delete(todo)
      .where(and(eq(todo.userId, userId.value), eq(todo.categoryId, categoryId.value)))
      .returning({ id: todo.id, scheduledTime: todo.scheduledTime });
    const series = await db
      .delete(todoSeries)
      .where(and(eq(todoSeries.userId, userId.value), eq(todoSeries.categoryId, categoryId.value)))
      .returning({ id: todoSeries.id });
    return {
      todos: todos.map((row) => ({
        id: TodoId.reconstitute(row.id),
        scheduledTime: row.scheduledTime,
      })),
      seriesCount: series.length,
    };
  }

  async removeIncompleteByIds(
    userId: UserId,
    todoIds: readonly TodoId[],
  ): Promise<readonly RemovedTodo[]> {
    if (todoIds.length === 0) {
      return [];
    }
    const rows = await this.#transactionHost.tx
      .delete(todo)
      .where(
        and(
          eq(todo.userId, userId.value),
          eq(todo.completed, false),
          inArray(
            todo.id,
            todoIds.map((todoId) => todoId.value),
          ),
        ),
      )
      .returning({ id: todo.id, scheduledTime: todo.scheduledTime });
    return rows.map((row) => ({
      id: TodoId.reconstitute(row.id),
      scheduledTime: row.scheduledTime,
    }));
  }
}
