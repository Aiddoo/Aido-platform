import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

import { TodoDetailsReaderPort } from "../../application/ports/todo-details.reader.port.js";
import type {
  TodoAccessReadModel,
  TodoDetailsReadModel,
} from "../../application/read-models/todo-details.read-model.js";
import type { TodoId } from "../../domain/todo-id.vo.js";
import { toFriendTodoReadModel } from "./todo-details-row.mapper.js";

@Injectable()
export class DrizzleTodoDetailsReader implements TodoDetailsReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findAccess(todoId: TodoId): Promise<TodoAccessReadModel | null> {
    const row = await this.#transactionHost.tx.query.todo.findFirst({
      columns: { userId: true, visibility: true },
      where: { id: todoId.value },
    });
    return row == null ? null : { ownerId: row.userId, visibility: row.visibility };
  }

  async findDetails(todoId: TodoId): Promise<TodoDetailsReadModel | null> {
    const row = await this.#transactionHost.tx.query.todo.findFirst({
      where: { id: todoId.value },
      with: {
        category: true,
        items: { orderBy: { sortOrder: "asc", id: "asc" } },
      },
    });
    return row == null ? null : { todo: toFriendTodoReadModel(row), viewCount: row.viewCount };
  }
}
