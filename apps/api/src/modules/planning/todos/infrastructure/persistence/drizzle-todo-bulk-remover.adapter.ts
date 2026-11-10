import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoSeries } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type {
  RemovedCategoryTodos,
  TodoBulkRemoverPort,
} from "../../application/ports/todo-bulk-remover.port.js";

@Injectable()
export class DrizzleTodoBulkRemoverAdapter implements TodoBulkRemoverPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async removeByCategory(
    userId: UserId,
    categoryId: TodoCategoryId,
  ): Promise<RemovedCategoryTodos> {
    const db = this.#txHost.tx;
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
}
