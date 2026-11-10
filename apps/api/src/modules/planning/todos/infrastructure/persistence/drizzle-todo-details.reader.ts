import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

import {
  type TodoAccessView,
  TodoDetailsReaderPort,
  type TodoDetailsView,
} from "../../application/ports/todo-details.reader.port.js";
import { toFriendTodoReadModel } from "./todo-details-row.mapper.js";

@Injectable()
export class DrizzleTodoDetailsReader implements TodoDetailsReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async findAccess(todoId: number): Promise<TodoAccessView | null> {
    const row = await this.#txHost.tx.query.todo.findFirst({
      columns: { userId: true, visibility: true },
      where: { id: todoId },
    });
    return row == null ? null : { ownerId: row.userId, visibility: row.visibility };
  }

  async findDetails(todoId: number): Promise<TodoDetailsView | null> {
    const row = await this.#txHost.tx.query.todo.findFirst({
      where: { id: todoId },
      with: {
        category: true,
        items: { orderBy: { sortOrder: "asc", id: "asc" } },
      },
    });
    return row == null ? null : { todo: toFriendTodoReadModel(row), viewCount: row.viewCount };
  }
}
